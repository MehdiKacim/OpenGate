import { createLogger, logDir, REDACT_KEYS } from "./log.ts"

import type { AnthropicRequest } from "./anthropic/schema.ts"
import type { OpenAIChatCompletionRequest, OpenAIChatCompletionChunk } from "./openai/schema.ts"
import type { AliasProvider } from "./config.ts"
import type { Provider, ProviderAdapter, RequestContext } from "./providers/types.ts"
import {
  allSupportedModels,
  ANTHROPIC_STYLE_ALIASES,
  providerForModel,
  adapterForModel,
  getAdapter,
  allAdapters,
} from "./providers/registry.ts"
import { resolveProfile, listProfiles } from "./profiles.ts"
import { legacyAdapterComplete } from "./openai/legacy-bridge.ts"

const rootLog = createLogger("server")

export interface ServeOptions {
  port: number
}

interface SessionState {
  seq: number
  affinityProvider?: AliasProvider
  lastSeen: number
}

const SESSION_IDLE_TTL_MS = 30 * 60 * 1000
const MAX_SESSIONS = 10_000
const sessions = new Map<string, SessionState>()

function existingSession(sessionId: string | undefined, now = Date.now()): SessionState | undefined {
  if (!sessionId) return undefined
  const state = sessions.get(sessionId)
  if (!state) return undefined
  if (now - state.lastSeen <= SESSION_IDLE_TTL_MS) return state
  sessions.delete(sessionId)
  return undefined
}

function recordSessionRequest(
  sessionId: string | undefined,
  session: SessionState | undefined,
  providerName: string,
  model: string,
  now = Date.now(),
): SessionState | undefined {
  if (!sessionId) return undefined
  const state = session ?? { seq: 0, lastSeen: now }
  state.seq += 1
  state.lastSeen = now
  const affinityProvider = affinityProviderFor(providerName)
  if (affinityProvider && !ANTHROPIC_STYLE_ALIASES.has(model)) {
    state.affinityProvider = affinityProvider
  }
  sessions.set(sessionId, state)
  evictOldestSessions()
  return state
}

function affinityProviderFor(providerName: string): AliasProvider | undefined {
  if (providerName === "codex" || providerName === "kimi") return providerName
  return undefined
}

function evictOldestSessions(): void {
  while (sessions.size > MAX_SESSIONS) {
    const oldestSessionId = sessions.keys().next().value
    if (!oldestSessionId) return
    sessions.delete(oldestSessionId)
  }
}

export function startServer(opts: ServeOptions): { stop: () => void; port: number } {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: opts.port,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url)
      const start = Date.now()
      const reqId = crypto.randomUUID()
      rootLog.info("request", {
        reqId,
        method: req.method,
        path: url.pathname,
        ...(url.search ? { query: redactedQuery(url) } : {}),
      })
      try {
        const resp = await route(req, url, reqId)
        const ms = Date.now() - start
        rootLog.info("response", { reqId, status: resp.status, ms })
        if (!resp.body) return resp
        return wrapStreamResponse(resp, reqId, start, rootLog)
      } catch (err) {
        if (isAbortError(err)) {
          rootLog.info("client disconnected", { reqId, ms: Date.now() - start })
          return new Response(null, { status: 499 })
        }
        rootLog.error("handler error", { reqId, err: String(err), stack: (err as Error)?.stack })
        return jsonError(500, "internal_error", String(err))
      }
    },
  })
  rootLog.info("server listening", { port: server.port, logDir: logDir() })
  return {
    port: Number(server.port),
    stop: () => server.stop(),
  }
}

async function route(req: Request, url: URL, reqId: string): Promise<Response> {
  if (url.pathname === "/healthz") {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    })
  }

  // OpenAI-compatible endpoints
  if (req.method === "GET" && url.pathname === "/v1/models") {
    return handleListModels(reqId)
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    return handleChatCompletions(req, reqId)
  }

  // Usage endpoints
  if (req.method === "GET" && url.pathname === "/_opengate/usage") {
    return handleUsage(reqId)
  }
  if (req.method === "GET" && url.pathname.startsWith("/_opengate/providers/") && url.pathname.endsWith("/usage")) {
    const name = url.pathname.slice("/_opengate/providers/".length, -"/usage".length)
    return handleProviderUsage(name, reqId)
  }

  // Anthropic-compatible endpoints
  if (req.method === "POST" && url.pathname === "/v1/messages/count_tokens") {
    const body = await parseJsonBody<AnthropicRequest>(req)
    if (body instanceof Response) return body
    const sessionId = req.headers.get("x-claude-code-session-id") || undefined
    const session = existingSession(sessionId)
    const provider = routeProvider(body, reqId, session?.affinityProvider)
    if (provider instanceof Response) return provider
    const current = recordSessionRequest(sessionId, session, provider.name, body.model)
    const ctx = buildCtx(req, reqId, provider.name, sessionId, current)
    ctx.childLogger("server").info("dispatch", { model: body.model })
    return provider.handleCountTokens(body, ctx)
  }

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    const body = await parseJsonBody<AnthropicRequest>(req)
    if (body instanceof Response) return body
    const sessionId = req.headers.get("x-claude-code-session-id") || undefined
    const session = existingSession(sessionId)
    const provider = routeProvider(body, reqId, session?.affinityProvider)
    if (provider instanceof Response) return provider
    const current = recordSessionRequest(sessionId, session, provider.name, body.model)
    const ctx = buildCtx(req, reqId, provider.name, sessionId, current)
    ctx.childLogger("server").info("dispatch", { model: body.model })
    return provider.handleMessages(body, ctx)
  }

  return jsonError(404, "not_found", `No route for ${req.method} ${url.pathname}`)
}

// ---- OpenAI-compatible handlers ----

async function handleListModels(reqId: string): Promise<Response> {
  const models = allSupportedModels()
  const openaiModels = models.map((m) => ({
    id: m.model,
    object: "model" as const,
    created: 0,
    owned_by: m.provider,
  }))
  return new Response(JSON.stringify({ object: "list", data: openaiModels }), {
    headers: { "content-type": "application/json" },
  })
}

async function handleChatCompletions(req: Request, reqId: string): Promise<Response> {
  const body = await parseJsonBody<OpenAIChatCompletionRequest>(req)
  if (body instanceof Response) return body

  let model = normalizeIncomingModel(body.model)
  const profile = resolveProfile(model)
  let adapter: ProviderAdapter

  if (profile) {
    model = profile.model
    adapter = getAdapter(profile.provider)
    // Inject system prompt if profile has one and no system message exists
    if (profile.systemPrompt && !body.messages.some((m) => m.role === "system")) {
      body.messages.unshift({ role: "system", content: profile.systemPrompt })
    }
    if (profile.temperature !== undefined && body.temperature === undefined) {
      body.temperature = profile.temperature
    }
    if (profile.maxTokens !== undefined && body.max_tokens === undefined) {
      body.max_tokens = profile.maxTokens
    }
  } else {
    const resolved = adapterForModel(model)
    if (!resolved) {
      rootLog.warn("unknown model", { reqId, model })
      return jsonError(400, "invalid_request_error", `Unknown model "${model}".`)
    }
    adapter = resolved
  }

  const sessionId = req.headers.get("x-claude-code-session-id") || undefined
  const session = existingSession(sessionId)
  const current = recordSessionRequest(sessionId, session, adapter.name, model)
  const ctx = buildCtx(req, reqId, adapter.name, sessionId, current)
  ctx.childLogger("server").info("dispatch", { model, provider: adapter.name, protocol: adapter.protocol })

  const wantStream = body.stream !== false

  try {
    const generator =
      adapter.protocol === "openai"
        ? adapter.complete(body, ctx)
        : legacyAdapterComplete(adapter, { ...body, model }, ctx)

    if (!wantStream) {
      let content = ""
      const tool_calls: Array<{
        id: string
        type: "function"
        function: { name: string; arguments: string }
      }> = []
      let finish_reason: string | null = "stop"
      let usage:
        | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
        | undefined

      for await (const chunk of generator) {
        if (chunk.type === "delta") {
          if (chunk.delta?.content) content += chunk.delta.content
          if (chunk.delta?.tool_calls) {
            for (const tc of chunk.delta.tool_calls) {
              const existing = tool_calls.find((t) => t.id && t.id === tc.id)
              if (existing) {
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments
                if (tc.function?.name) existing.function.name = tc.function.name
              } else if (tc.id) {
                tool_calls.push({
                  id: tc.id,
                  type: "function",
                  function: {
                    name: tc.function?.name ?? "",
                    arguments: tc.function?.arguments ?? "",
                  },
                })
              }
            }
          }
        } else if (chunk.type === "usage") {
          usage = chunk.usage
        } else if (chunk.type === "finish") {
          finish_reason = chunk.finish_reason ?? "stop"
        }
      }

      const message: { role: "assistant"; content: string | null; tool_calls?: typeof tool_calls } =
        { role: "assistant", content: content || null }
      if (tool_calls.length > 0) message.tool_calls = tool_calls

      const resp = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion" as const,
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message,
            finish_reason,
            logprobs: null,
          },
        ],
        usage,
      }
      return new Response(JSON.stringify(resp), {
        headers: { "content-type": "application/json" },
      })
    }

    // Streaming response
    const encoder = new TextEncoder()
    const id = `chatcmpl-${Date.now()}`
    let index = 0

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            if (chunk.type === "delta") {
              const openaiChunk: OpenAIChatCompletionChunk = {
                id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: {
                      role: chunk.delta?.role,
                      content: chunk.delta?.content,
                      tool_calls: chunk.delta?.tool_calls,
                    },
                    finish_reason: null,
                  },
                ],
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
            } else if (chunk.type === "usage") {
              const openaiChunk: OpenAIChatCompletionChunk = {
                id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{ index: 0, delta: {}, finish_reason: null }],
                usage: chunk.usage,
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
            } else if (chunk.type === "finish") {
              const openaiChunk: OpenAIChatCompletionChunk = {
                id,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: {},
                    finish_reason: chunk.finish_reason ?? "stop",
                  },
                ],
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`))
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            }
          }
        } catch (err) {
          controller.error(err)
          return
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    })
  } catch (err) {
    rootLog.error("chat completion error", { reqId, err: String(err) })
    return jsonError(500, "internal_error", String(err))
  }
}

// ---- Usage handlers ----

async function handleUsage(reqId: string): Promise<Response> {
  const adapters = allAdapters()
  const result: Record<string, unknown> = {}
  for (const a of adapters) {
    if (a.usage) {
      try {
        result[a.name] = await a.usage()
      } catch {
        result[a.name] = { error: "failed to fetch usage" }
      }
    } else {
      result[a.name] = { error: "usage not supported" }
    }
  }
  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  })
}

async function handleProviderUsage(name: string, reqId: string): Promise<Response> {
  try {
    const adapter = getAdapter(name)
    if (!adapter.usage) {
      return jsonError(404, "not_supported", `Usage not supported for provider ${name}`)
    }
    const usage = await adapter.usage()
    return new Response(JSON.stringify(usage), {
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    return jsonError(404, "not_found", `Provider ${name} not found`)
  }
}

// ---- Anthropic helpers ----

function buildCtx(
  req: Request,
  reqId: string,
  providerName: string,
  sessionId: string | undefined,
  session: SessionState | undefined,
): RequestContext {
  const sessionSeq = session?.seq
  const bindings = { reqId, sessionId, sessionSeq, provider: providerName }
  return {
    reqId,
    sessionId,
    sessionSeq,
    signal: req.signal,
    childLogger: (service) => createLogger(service, bindings),
  }
}

export function normalizeIncomingModel(model: string): string {
  return model.replace(/\[1m\]$/i, "")
}

function routeProvider(
  body: AnthropicRequest,
  reqId: string,
  sessionAliasProvider?: AliasProvider,
): Provider | Response {
  if (!body.model) {
    return jsonError(
      400,
      "invalid_request_error",
      `Missing "model" in request body. ${knownModelsMessage()}`,
    )
  }
  body.model = normalizeIncomingModel(body.model)
  const provider = providerForModel(body.model, sessionAliasProvider)
  if (!provider) {
    rootLog.warn("unknown model", { reqId, model: body.model })
    return jsonError(
      400,
      "invalid_request_error",
      `Unknown model "${body.model}". ${knownModelsMessage()}`,
    )
  }
  return provider
}

function knownModelsMessage(): string {
  const groups = new Map<string, string[]>()
  for (const { model, provider } of allSupportedModels()) {
    const list = groups.get(provider) ?? []
    list.push(model)
    groups.set(provider, list)
  }
  const parts: string[] = []
  for (const [provider, models] of groups) {
    parts.push(`${provider}: ${models.join(", ")}`)
  }
  return `Supported: ${parts.join("; ")}.`
}

async function parseJsonBody<T>(req: Request): Promise<T | Response> {
  try {
    return (await req.json()) as T
  } catch (err) {
    return jsonError(400, "invalid_request_error", `Invalid JSON: ${err}`)
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError"
}

function wrapStreamResponse(
  resp: Response,
  reqId: string,
  start: number,
  log: ReturnType<typeof createLogger>,
): Response {
  const body = resp.body!
  const reader = body.getReader()
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          log.info("request_completed", { reqId, status: resp.status, ms: Date.now() - start })
          controller.close()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        if (isAbortError(err)) {
          log.info("client disconnected", { reqId, ms: Date.now() - start })
        } else {
          log.error("stream error", { reqId, err: String(err) })
        }
        controller.error(err)
      }
    },
    cancel() {
      reader.cancel().catch(() => {})
    },
  })
  const headers = new Headers(resp.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  return new Response(stream, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  })
}

function redactedQuery(url: URL): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of url.searchParams) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? `[redacted len=${v.length}]` : v
  }
  return out
}

function jsonError(status: number, type: string, message: string): Response {
  return new Response(JSON.stringify({ type: "error", error: { type, message } }), {
    status,
    headers: { "content-type": "application/json" },
  })
}
