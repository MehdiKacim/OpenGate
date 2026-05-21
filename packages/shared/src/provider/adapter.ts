import type { OpenAIChatCompletionRequest } from "../openai/schema.js"

export interface ProviderModel {
  id: string
  displayName?: string
  contextWindow?: number
  capabilities?: string[]
}

export interface ProviderHealth {
  ok: boolean
  latencyMs?: number
  error?: string
}

export interface RequestContext {
  reqId: string
  providerId: string
  routeProfileId: string
  childLogger(service: string): {
    info: (msg: string, obj?: Record<string, unknown>) => void
    warn: (msg: string, obj?: Record<string, unknown>) => void
    error: (msg: string, obj?: Record<string, unknown>) => void
  }
}

export interface ProviderAdapter {
  id: string
  displayName: string
  kind: "oauth" | "proxy" | "static"
  protocol: "openai"
  listModels(): Promise<ProviderModel[]>
  chatCompletions(req: OpenAIChatCompletionRequest, ctx: RequestContext): Promise<Response>
  health?(): Promise<ProviderHealth>
}
