import { z } from "zod"

export const OpenAIMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.null()]).optional(),
  name: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
  tool_call_id: z.string().optional(),
})

export type OpenAIMessage = z.infer<typeof OpenAIMessageSchema>

export const OpenAIChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OpenAIMessageSchema).min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  tools: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.any()).optional(),
        }),
      }),
    )
    .optional(),
  tool_choice: z
    .union([
      z.literal("none"),
      z.literal("auto"),
      z.literal("required"),
      z.object({
        type: z.literal("function"),
        function: z.object({ name: z.string() }),
      }),
    ])
    .optional(),
  response_format: z
    .object({
      type: z.literal("json_object"),
    })
    .optional(),
})

export type OpenAIChatCompletionRequest = z.infer<typeof OpenAIChatCompletionRequestSchema>

export const OpenAIChatCompletionChoiceSchema = z.object({
  index: z.number().int(),
  message: OpenAIMessageSchema,
  finish_reason: z.string().nullable(),
})

export const OpenAIUsageSchema = z.object({
  prompt_tokens: z.number().int(),
  completion_tokens: z.number().int(),
  total_tokens: z.number().int(),
})

export const OpenAIChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(OpenAIChatCompletionChoiceSchema),
  usage: OpenAIUsageSchema.optional(),
})

export type OpenAIChatCompletionResponse = z.infer<typeof OpenAIChatCompletionResponseSchema>

export const OpenAIChatCompletionChunkChoiceSchema = z.object({
  index: z.number().int(),
  delta: z.object({
    role: z.string().optional(),
    content: z.string().optional(),
    tool_calls: z
      .array(
        z.object({
          index: z.number().int(),
          id: z.string().optional(),
          type: z.literal("function").optional(),
          function: z.object({
            name: z.string().optional(),
            arguments: z.string().optional(),
          }),
        }),
      )
      .optional(),
  }),
  finish_reason: z.string().nullable().optional(),
})

export const OpenAIChatCompletionChunkSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(OpenAIChatCompletionChunkChoiceSchema),
})

export type OpenAIChatCompletionChunk = z.infer<typeof OpenAIChatCompletionChunkSchema>

export const OpenAIModelSchema = z.object({
  id: z.string(),
  object: z.literal("model"),
  created: z.number().int().default(0),
  owned_by: z.string(),
})

export type OpenAIModel = z.infer<typeof OpenAIModelSchema>

export const OpenAIModelListSchema = z.object({
  object: z.literal("list"),
  data: z.array(OpenAIModelSchema),
})

export type OpenAIModelList = z.infer<typeof OpenAIModelListSchema>
