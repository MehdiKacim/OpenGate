import type { AnthropicRequest } from "../anthropic/schema.ts"
import type { OpenAIChatCompletionRequest } from "../openai/schema.ts"
import type { Logger } from "../log.ts"

export interface RequestContext {
  reqId: string
  sessionId?: string
  sessionSeq?: number
  signal: AbortSignal
  childLogger(service: string): Logger
}

export interface CliHandlers {
  login?: () => Promise<void>
  device?: () => Promise<void>
  status: () => Promise<void>
  logout: () => Promise<void>
}

export interface CompletionChunk {
  type: "delta" | "usage" | "finish"
  delta?: {
    role?: string
    content?: string | null
    tool_calls?: Array<{
      id: string
      type: "function"
      function: { name: string; arguments: string }
    }>
  }
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason?: string | null
}

export interface Model {
  id: string
  provider: string
}

export interface UsageSnapshot {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  requests: number
}

export interface ProviderAdapter {
  name: string
  protocol: "openai" | "anthropic"
  supportedModels: Set<string>
  listModels(): Promise<Model[]>
  complete(request: OpenAIChatCompletionRequest, ctx: RequestContext): AsyncIterable<CompletionChunk>
  usage?(): Promise<UsageSnapshot>
  // Legacy Anthropic support
  handleMessages?(body: AnthropicRequest, ctx: RequestContext): Promise<Response>
  handleCountTokens?(body: AnthropicRequest, ctx: RequestContext): Promise<Response>
  cli: CliHandlers
}

// Legacy Provider interface preserved for backward compatibility during transition
export interface Provider {
  name: string
  supportedModels: Set<string>
  handleMessages(body: AnthropicRequest, ctx: RequestContext): Promise<Response>
  handleCountTokens(body: AnthropicRequest, ctx: RequestContext): Promise<Response>
  cli: CliHandlers
}
