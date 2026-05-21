import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionChunk,
  OpenAIChatCompletion,
  OpenAIMessage,
  OpenAITool,
  OpenAIToolCall,
} from "./schema.ts"
import type {
  AnthropicRequest,
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicTool,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
  AnthropicTextBlock,
  AnthropicThinkingBlock,
} from "../anthropic/schema.ts"

// OpenAI → Anthropic
export function openAIToAnthropic(req: OpenAIChatCompletionRequest): AnthropicRequest {
  const messages: AnthropicMessage[] = []
  let system: string | AnthropicTextBlock[] | undefined

  for (const msg of req.messages) {
    if (msg.role === "system") {
      if (typeof msg.content === "string") {
        if (system === undefined) {
          system = msg.content
        } else if (typeof system === "string") {
          system = system + "\n" + msg.content
        } else {
          system.push({ type: "text", text: msg.content })
        }
      }
      continue
    }

    if (msg.role === "tool") {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "",
            content: (msg.content as string) ?? "",
          } satisfies AnthropicToolResultBlock,
        ],
      })
      continue
    }

    if (msg.role === "assistant" && msg.tool_calls) {
      const content: AnthropicContentBlock[] = []
      if (msg.content) {
        content.push({ type: "text", text: msg.content })
      }
      for (const tc of msg.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        } satisfies AnthropicToolUseBlock)
      }
      messages.push({ role: "assistant", content })
      continue
    }

    if (typeof msg.content === "string") {
      messages.push({ role: msg.role === "user" ? "user" : "assistant", content: msg.content })
    } else {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: [{ type: "text", text: String(msg.content) }],
      })
    }
  }

  const tools: AnthropicTool[] | undefined = req.tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }))

  const out: AnthropicRequest = {
    model: req.model,
    messages,
    system,
    max_tokens: req.max_tokens,
    temperature: req.temperature,
    top_p: req.top_p,
    stream: req.stream,
  }

  if (tools) out.tools = tools
  if (req.tool_choice) {
    if (req.tool_choice === "auto") out.tool_choice = { type: "auto" }
    else if (req.tool_choice === "none") out.tool_choice = { type: "none" }
    else if (typeof req.tool_choice === "object") {
      out.tool_choice = { type: "tool", name: req.tool_choice.function.name }
    }
  }

  return out
}

// Anthropic → OpenAI (non-streaming)
export function anthropicToOpenAI(
  anthropicBody: AnthropicRequest,
  anthropicResponse: unknown,
): OpenAIChatCompletion {
  const resp = anthropicResponse as {
    id?: string
    model?: string
    content?: AnthropicContentBlock[]
    usage?: {
      input_tokens?: number
      output_tokens?: number
    }
    stop_reason?: string
  }

  const contentBlocks = resp.content ?? []
  let content = ""
  const tool_calls: OpenAIToolCall[] = []

  for (const block of contentBlocks) {
    if (block.type === "text") {
      content += block.text
    } else if (block.type === "tool_use") {
      tool_calls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      })
    }
  }

  const message: OpenAIMessage = { role: "assistant", content: content || null }
  if (tool_calls.length > 0) {
    message.tool_calls = tool_calls
  }

  return {
    id: resp.id ?? `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: resp.model ?? anthropicBody.model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: mapStopReason(resp.stop_reason),
        logprobs: null,
      },
    ],
    usage: resp.usage
      ? {
          prompt_tokens: resp.usage.input_tokens ?? 0,
          completion_tokens: resp.usage.output_tokens ?? 0,
          total_tokens: (resp.usage.input_tokens ?? 0) + (resp.usage.output_tokens ?? 0),
        }
      : undefined,
  }
}

function mapStopReason(reason?: string): string | null {
  if (!reason) return "stop"
  if (reason === "end_turn") return "stop"
  if (reason === "tool_use") return "tool_calls"
  if (reason === "max_tokens") return "length"
  return "stop"
}

// Convert an Anthropic SSE chunk line into an OpenAI chunk
export function anthropicChunkToOpenAI(
  anthropicBody: AnthropicRequest,
  line: string,
  opts: { id: string; model: string },
): OpenAIChatCompletionChunk | null {
  if (!line.startsWith("data: ")) return null
  const json = line.slice(6)
  if (json === "[DONE]") {
    return {
      id: opts.id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: opts.model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    }
  }

  let event: unknown
  try {
    event = JSON.parse(json)
  } catch {
    return null
  }

  const e = event as {
    type?: string
    delta?: { type?: string; text?: string; thinking?: string; partial_json?: string }
    content_block?: { type?: string; id?: string; name?: string; input?: unknown }
    usage?: { input_tokens?: number; output_tokens?: number }
    stop_reason?: string
  }

  const delta: Partial<OpenAIMessage> = {}
  let finish_reason: string | null = null

  if (e.type === "content_block_delta") {
    if (e.delta?.type === "text_delta") {
      delta.content = e.delta.text ?? ""
    } else if (e.delta?.type === "thinking_delta") {
      // thinking is dropped in standard OpenAI format
    } else if (e.delta?.type === "input_json_delta") {
      // tool call arguments streaming - not supported in simple mapping
    }
  } else if (e.type === "content_block_start") {
    if (e.content_block?.type === "tool_use") {
      delta.tool_calls = [
        {
          index: 0,
          id: e.content_block.id,
          type: "function",
          function: { name: e.content_block.name, arguments: "" },
        } as any,
      ]
    }
  } else if (e.type === "message_delta") {
    if (e.stop_reason) {
      finish_reason = mapStopReason(e.stop_reason)
    }
  }

  if (!delta.content && !delta.tool_calls && !finish_reason) {
    return null
  }

  const chunk: OpenAIChatCompletionChunk = {
    id: opts.id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: opts.model,
    choices: [{ index: 0, delta, finish_reason }],
  }

  if (e.usage) {
    chunk.usage = {
      prompt_tokens: e.usage.input_tokens ?? 0,
      completion_tokens: e.usage.output_tokens ?? 0,
      total_tokens: (e.usage.input_tokens ?? 0) + (e.usage.output_tokens ?? 0),
    }
  }

  return chunk
}
