import type { ProviderAdapter, RequestContext, CompletionChunk } from "../providers/types.ts"
import type { OpenAIChatCompletionRequest, OpenAIChatCompletionChunk } from "./schema.ts"
import type { AnthropicRequest } from "../anthropic/schema.ts"
import { openAIToAnthropic, anthropicToOpenAI, anthropicChunkToOpenAI } from "./adapter.ts"

export async function* legacyAdapterComplete(
  adapter: ProviderAdapter,
  request: OpenAIChatCompletionRequest,
  ctx: RequestContext,
): AsyncIterable<CompletionChunk> {
  const log = ctx.childLogger("legacy-bridge")
  const anthropicReq = openAIToAnthropic(request)

  if (!adapter.handleMessages) {
    throw new Error(`Legacy adapter ${adapter.name} missing handleMessages`)
  }

  const resp = await adapter.handleMessages(anthropicReq, ctx)

  if (request.stream) {
    const reader = resp.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    const id = `chatcmpl-${Date.now()}`
    const model = request.model

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (trimmed.startsWith("event: ")) continue
          if (!trimmed.startsWith("data: ")) continue
          const data = trimmed.slice(6)
          if (data === "[DONE]") {
            yield { type: "finish", finish_reason: "stop" }
            continue
          }
          try {
            const event = JSON.parse(data)
            if (event.type === "message_start") {
              // yield empty delta to signal start
              yield { type: "delta", delta: { role: "assistant" } }
            } else if (event.type === "content_block_delta") {
              if (event.delta?.type === "text_delta") {
                yield { type: "delta", delta: { content: event.delta.text } }
              }
            } else if (event.type === "message_delta") {
              if (event.delta?.stop_reason) {
                yield {
                  type: "finish",
                  finish_reason: mapAnthropicStopReason(event.delta.stop_reason),
                }
              }
              if (event.usage) {
                yield {
                  type: "usage",
                  usage: {
                    prompt_tokens: event.usage.input_tokens ?? 0,
                    completion_tokens: event.usage.output_tokens ?? 0,
                    total_tokens:
                      (event.usage.input_tokens ?? 0) + (event.usage.output_tokens ?? 0),
                  },
                }
              }
            }
          } catch {
            // ignore malformed
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {})
    }
  } else {
    const body = await resp.json()
    const openaiResp = anthropicToOpenAI(anthropicReq, body)
    yield {
      type: "delta",
      delta: {
        role: openaiResp.choices[0].message.role,
        content: openaiResp.choices[0].message.content,
        tool_calls: openaiResp.choices[0].message.tool_calls,
      },
    }
    if (openaiResp.usage) {
      yield {
        type: "usage",
        usage: {
          prompt_tokens: openaiResp.usage.prompt_tokens,
          completion_tokens: openaiResp.usage.completion_tokens,
          total_tokens: openaiResp.usage.total_tokens,
        },
      }
    }
    yield { type: "finish", finish_reason: openaiResp.choices[0].finish_reason }
  }
}

function mapAnthropicStopReason(reason: string): string | null {
  if (reason === "end_turn") return "stop"
  if (reason === "tool_use") return "tool_calls"
  if (reason === "max_tokens") return "length"
  return "stop"
}
