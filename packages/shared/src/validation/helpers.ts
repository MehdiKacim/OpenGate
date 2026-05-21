import { z } from "zod"

export function strictBoolean() {
  return z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .transform((v) => (typeof v === "boolean" ? v : v === 1))
}

export function jsonString<T extends z.ZodTypeAny>(schema: T) {
  return z.string().transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str)
      return schema.parse(parsed)
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON" })
      return z.NEVER
    }
  })
}

export function timestamp() {
  return z.string().datetime()
}
