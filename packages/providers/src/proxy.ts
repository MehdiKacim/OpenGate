import type {
  ProviderAdapter,
  ProviderModel,
  RequestContext,
  OpenAIChatCompletionRequest,
} from "@opengate/shared"

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "")
}

function concatToArrayBuffer(chunks: Uint8Array[]): ArrayBuffer {
  const total = chunks.reduce((sum, c) => sum + c.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result.buffer
}

async function proxyFetch(
  url: string,
  init: RequestInit & { allowInvalidCertificates?: boolean },
): Promise<Response> {
  if (!init.allowInvalidCertificates) {
    return fetch(url, init)
  }

  const parsed = new URL(url)
  const isHttps = parsed.protocol === "https:"
  const mod = await import(isHttps ? "node:https" : "node:http")
  const agent = isHttps ? new mod.Agent({ rejectUnauthorized: false }) : undefined

  return new Promise((resolve, reject) => {
    const req = mod.request(
      parsed,
      {
        method: init.method || "GET",
        headers: init.headers as Record<string, string>,
        agent,
      },
      (res: any) => {
        const chunks: Uint8Array[] = []
        res.on("data", (chunk: Uint8Array) => chunks.push(chunk))
        res.on("end", () => {
          const headers = new Headers()
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) {
              for (const v of value) headers.append(key, v)
            } else if (typeof value === "string") {
              headers.set(key, value)
            }
          }
          resolve(
            new Response(concatToArrayBuffer(chunks), {
              status: res.statusCode || 200,
              statusText: res.statusMessage || "",
              headers,
            }),
          )
        })
      },
    )
    req.on("error", reject)
    if (init.body) {
      req.write(init.body)
    }
    req.end()
  })
}

export interface ProxyProviderOptions {
  id: string
  displayName: string
  baseUrl: string
  apiKey?: string
  allowInvalidCertificates?: boolean
}

export function createProxyProvider(opts: ProxyProviderOptions): ProviderAdapter {
  const baseUrl = normalizeBaseUrl(opts.baseUrl)

  return {
    id: opts.id,
    displayName: opts.displayName,
    kind: "proxy",
    protocol: "openai",

    async listModels(): Promise<ProviderModel[]> {
      const res = await proxyFetch(`${baseUrl}/models`, {
        method: "GET",
        headers: opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {},
        allowInvalidCertificates: opts.allowInvalidCertificates,
      })
      if (!res.ok) return []
      const data = await res.json().catch(() => ({}))
      const models = Array.isArray(data.data) ? data.data : []
      return models.map((m: { id: string; name?: string }) => ({
        id: m.id,
        displayName: m.name || m.id,
      }))
    },

    async chatCompletions(
      req: OpenAIChatCompletionRequest,
      _ctx: RequestContext,
    ): Promise<Response> {
      const res = await proxyFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify(req),
        allowInvalidCertificates: opts.allowInvalidCertificates,
      })
      return res
    },
  }
}
