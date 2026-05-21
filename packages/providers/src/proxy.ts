import type {
  ProviderAdapter,
  ProviderModel,
  RequestContext,
  OpenAIChatCompletionRequest,
} from "@opengate/shared"

export interface ProxyProviderOptions {
  id: string
  displayName: string
  baseUrl: string
  apiKey?: string
  allowInvalidCertificates?: boolean
}

export function createProxyProvider(opts: ProxyProviderOptions): ProviderAdapter {
  return {
    id: opts.id,
    displayName: opts.displayName,
    kind: "proxy",
    protocol: "openai",

    async listModels(): Promise<ProviderModel[]> {
      const res = await fetch(`${opts.baseUrl}/models`, {
        headers: opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {},
      })
      if (!res.ok) return []
      const data = await res.json()
      const models = Array.isArray(data.data) ? data.data : []
      return models.map((m: { id: string }) => ({
        id: m.id,
        displayName: m.id,
      }))
    },

    async chatCompletions(
      req: OpenAIChatCompletionRequest,
      _ctx: RequestContext,
    ): Promise<Response> {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify(req),
      })
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: {
          "content-type": res.headers.get("content-type") || "application/json",
        },
      })
    },
  }
}
