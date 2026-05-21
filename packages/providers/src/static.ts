import type {
  ProviderAdapter,
  ProviderModel,
  RequestContext,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIChatCompletionChunk,
} from "@opengate/shared"

export function createStaticProvider(): ProviderAdapter {
  return {
    id: "static",
    displayName: "Static Test",
    kind: "static",
    protocol: "openai",

    async listModels(): Promise<ProviderModel[]> {
      return [
        {
          id: "static-echo",
          displayName: "Static Echo",
          contextWindow: 4096,
        },
      ]
    },

    async chatCompletions(
      req: OpenAIChatCompletionRequest,
      ctx: RequestContext,
    ): Promise<Response> {
      const encoder = new TextEncoder()

      if (req.stream) {
        const stream = new ReadableStream({
          start(controller) {
            const chunk: OpenAIChatCompletionChunk = {
              id: ctx.reqId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: req.model,
              choices: [
                {
                  index: 0,
                  delta: { role: "assistant", content: "Echo: " },
                  finish_reason: null,
                },
              ],
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))

            const lastChunk: OpenAIChatCompletionChunk = {
              id: ctx.reqId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: req.model,
              choices: [
                {
                  index: 0,
                  delta: { content: JSON.stringify(req.messages.slice(-1)) },
                  finish_reason: "stop",
                },
              ],
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(lastChunk)}\n\n`))
            controller.enqueue(encoder.encode("data: [DONE]\n\n"))
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
      }

      const response: OpenAIChatCompletionResponse = {
        id: ctx.reqId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: req.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: `Echo: ${JSON.stringify(req.messages)}`,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }

      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      })
    },
  }
}
