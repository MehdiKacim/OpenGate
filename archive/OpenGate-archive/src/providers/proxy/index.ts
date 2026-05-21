import type { ProviderAdapter, RequestContext, CompletionChunk, Model, UsageSnapshot, CliHandlers } from "../types.ts"
import type { OpenAIChatCompletionRequest } from "../../openai/schema.ts"

export interface ProxyProviderConfig {
  name: string
  baseUrl: string
  models: string[]
  apiKey?: string
  allowInvalidCertificates?: boolean
}

export function createProxyProvider(config: ProxyProviderConfig): ProviderAdapter {
  const supportedModels = new Set(config.models)

  async function* complete(
    request: OpenAIChatCompletionRequest,
    ctx: RequestContext,
  ): AsyncIterable<CompletionChunk> {
    const log = ctx.childLogger("provider.proxy")
    const url = `${config.baseUrl}/chat/completions`
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "accept": "text/event-stream",
    }
    if (config.apiKey) {
      headers["authorization"] = `Bearer ${config.apiKey}`
    }

    log.info("proxy request", { provider: config.name, model: request.model, url })

    const body = JSON.stringify(request)
    const fetchOpts: RequestInit = {
      method: "POST",
      headers,
      body,
      signal: ctx.signal,
    }

    if (config.allowInvalidCertificates) {
      // Bun-specific: tls rejectUnauthorized
      ;(fetchOpts as any).tls = { rejectUnauthorized: false }
    }

    const resp = await fetch(url, fetchOpts)
    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      log.error("proxy error", { status: resp.status, body: text })
      throw new Error(`Proxy provider ${config.name} returned ${resp.status}: ${text}`)
    }

    if (!request.stream) {
      const data = await resp.json()
      const choice = data.choices?.[0]
      if (choice) {
        yield {
          type: "delta",
          delta: {
            role: choice.message?.role,
            content: choice.message?.content,
            tool_calls: choice.message?.tool_calls,
          },
        }
      }
      if (data.usage) {
        yield {
          type: "usage",
          usage: {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
          },
        }
      }
      yield { type: "finish", finish_reason: choice?.finish_reason ?? "stop" }
      return
    }

    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith("data: ")) continue
          const data = trimmed.slice(6)
          if (data === "[DONE]") {
            yield { type: "finish", finish_reason: "stop" }
            continue
          }
          try {
            const chunk = JSON.parse(data)
            const choice = chunk.choices?.[0]
            if (choice) {
              yield {
                type: "delta",
                delta: {
                  role: choice.delta?.role,
                  content: choice.delta?.content,
                  tool_calls: choice.delta?.tool_calls,
                },
              }
            }
            if (chunk.usage) {
              yield {
                type: "usage",
                usage: {
                  prompt_tokens: chunk.usage.prompt_tokens,
                  completion_tokens: chunk.usage.completion_tokens,
                  total_tokens: chunk.usage.total_tokens,
                },
              }
            }
            if (choice?.finish_reason) {
              yield { type: "finish", finish_reason: choice.finish_reason }
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {})
    }
  }

  return {
    name: config.name,
    protocol: "openai",
    supportedModels,
    async listModels(): Promise<Model[]> {
      return config.models.map((id) => ({ id, provider: config.name }))
    },
    complete,
    cli: {
      status: async () => {
        console.log(`${config.name}: proxy provider (no auth required)`)
      },
      logout: async () => {
        console.log(`${config.name}: nothing to clear`)
      },
    },
  }
}
