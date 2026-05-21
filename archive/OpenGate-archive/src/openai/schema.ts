export interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool"
  content?: string | null
  name?: string
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
}

export interface OpenAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAITool {
  type: "function"
  function: {
    name: string
    description?: string
    parameters: unknown
  }
}

export interface OpenAIChatCompletionRequest {
  model: string
  messages: OpenAIMessage[]
  tools?: OpenAITool[]
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } }
  max_tokens?: number
  temperature?: number
  top_p?: number
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  response_format?: { type: "json_object" | "json_schema"; schema?: unknown }
}

export interface OpenAIChatCompletionChunk {
  id: string
  object: "chat.completion.chunk"
  created: number
  model: string
  choices: Array<{
    index: number
    delta: Partial<OpenAIMessage>
    finish_reason: string | null
    logprobs?: null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIChatCompletion {
  id: string
  object: "chat.completion"
  created: number
  model: string
  choices: Array<{
    index: number
    message: OpenAIMessage
    finish_reason: string | null
    logprobs?: null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface OpenAIModel {
  id: string
  object: "model"
  created: number
  owned_by: string
}
