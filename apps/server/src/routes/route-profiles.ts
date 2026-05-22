import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import { createProviderAdapter } from "@opengate/providers"
import { resolveRouting } from "@opengate/routing"
import { OpenAIChatCompletionRequestSchema } from "@opengate/shared"

export interface RouteProfileRouteOptions {
  db: Kysely<Database>
}

export function routeProfileRoutes(opts: RouteProfileRouteOptions) {
  const app = new Hono()

  app.get("/models", async (c) => {
    const profileSlug = c.req.param("profileSlug")
    if (!profileSlug) {
      return c.json({ error: "Missing profile slug" }, 400)
    }

    const profile = await opts.db
      .selectFrom("route_profiles")
      .select(["id", "slug", "name"])
      .where("slug", "=", profileSlug)
      .executeTakeFirst()

    if (!profile) {
      return c.json({ error: `Route profile not found: ${profileSlug}` }, 404)
    }

    const experts = await opts.db
      .selectFrom("experts")
      .select(["name", "display_name"])
      .where("route_profile_id", "=", profile.id)
      .where("enabled", "=", 1)
      .where("expose_as_model", "=", 1)
      .execute()

    const data = experts.map((e: { name: string; display_name: string | null }) => ({
      id: e.name,
      object: "model" as const,
      created: 0,
      owned_by: "opengate",
    }))

    return c.json({ object: "list", data })
  })

  app.post("/chat/completions", async (c) => {
    const profileSlug = c.req.param("profileSlug")
    if (!profileSlug) {
      return c.json({ error: "Missing profile slug" }, 400)
    }

    const profile = await opts.db
      .selectFrom("route_profiles")
      .select(["id", "slug", "name"])
      .where("slug", "=", profileSlug)
      .executeTakeFirst()

    if (!profile) {
      return c.json({ error: `Route profile not found: ${profileSlug}` }, 404)
    }

    const json = await c.req.json().catch(() => null)
    if (!json) {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    const parsedBody = OpenAIChatCompletionRequestSchema.safeParse(json)
    if (!parsedBody.success) {
      return c.json({
        error: "Invalid OpenAI chat completion request",
        issues: parsedBody.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      }, 400)
    }

    const body = parsedBody.data
    const modelName = body.model
    const reqId = randomUUID()
    const startedAt = new Date().toISOString()

    // Insert request record
    await opts.db
      .insertInto("requests")
      .values({
        id: reqId,
        route_profile_id: profile.id,
        requested_model: modelName,
        status: "pending",
        started_at: startedAt,
      })
      .execute()

    // Resolve routing
    const userMessage =
      body.messages?.find((m) => m.role === "user")
        ?.content || ""

    const routing = await resolveRouting({
      db: opts.db,
      profileId: profile.id,
      modelName,
      userMessageText: typeof userMessage === "string" ? userMessage : "",
    })

    if (!routing) {
      await opts.db
        .updateTable("requests")
        .set({ status: "error", finished_at: new Date().toISOString(), error: `Unknown model: ${modelName}` })
        .where("id", "=", reqId)
        .execute()
      return c.json({ error: `Unknown model: ${modelName}` }, 400)
    }

    // Insert routing event
    await opts.db
      .insertInto("routing_events")
      .values({
        id: randomUUID(),
        request_id: reqId,
        expert_name: routing.expertName,
        detected_keywords_json: JSON.stringify(routing.detectedKeywords),
        selected_provider_id: routing.selectedProviderId,
        selected_model_id: routing.selectedModelId,
        override_keyword: routing.overrideKeyword ?? null,
        reason: routing.reason,
        created_at: new Date().toISOString(),
      })
      .execute()

    // Load the resolved provider and model
    const selectedProvider = await opts.db
      .selectFrom("providers")
      .select([
        "id",
        "name",
        "type",
        "adapter",
        "protocol",
        "base_url",
        "auth_type",
        "allow_invalid_certificates",
        "enabled",
      ])
      .where("id", "=", routing.selectedProviderId)
      .executeTakeFirst()

    const selectedModel = await opts.db
      .selectFrom("provider_models")
      .select(["id", "provider_id", "model_id", "display_name", "enabled"])
      .where("id", "=", routing.selectedModelId)
      .executeTakeFirst()

    if (!selectedProvider || !selectedModel) {
      await opts.db
        .updateTable("requests")
        .set({ status: "error", finished_at: new Date().toISOString(), error: `Resolved provider or model not found` })
        .where("id", "=", reqId)
        .execute()
      return c.json({ error: "Resolved provider or model not found" }, 500)
    }

    if (selectedProvider.enabled !== 1 || selectedModel.enabled !== 1) {
      await opts.db
        .updateTable("requests")
        .set({ status: "error", finished_at: new Date().toISOString(), error: `Resolved provider or model is disabled` })
        .where("id", "=", reqId)
        .execute()
      return c.json({ error: "Resolved provider or model is disabled" }, 400)
    }

    // Load expert for system prompt and generation parameters
    const expert = await opts.db
      .selectFrom("experts")
      .select(["system_prompt", "temperature", "max_tokens"])
      .where("route_profile_id", "=", profile.id)
      .where("name", "=", modelName)
      .where("enabled", "=", 1)
      .executeTakeFirst()

    if (!expert) {
      await opts.db
        .updateTable("requests")
        .set({ status: "error", finished_at: new Date().toISOString(), error: `Expert not found: ${modelName}` })
        .where("id", "=", reqId)
        .execute()
      return c.json({ error: `Expert not found: ${modelName}` }, 400)
    }

    // Build enriched system prompt
    let systemPrompt = expert.system_prompt || ""
    if (routing.systemPromptEnrichment) {
      systemPrompt = systemPrompt
        ? `${systemPrompt}\n\n${routing.systemPromptEnrichment}`
        : routing.systemPromptEnrichment
    }

    const openaiReq = {
      model: selectedModel.model_id,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...(body.messages || []),
      ],
      stream: body.stream === true,
      temperature: expert.temperature ?? body.temperature,
      max_tokens: expert.max_tokens ?? body.max_tokens,
    }

    // Instantiate provider adapter from resolved provider row
    const provider = createProviderAdapter(selectedProvider)

    const ctx = {
      reqId,
      providerId: selectedProvider.id,
      routeProfileId: profile.id,
      childLogger: () => ({
        info: () => {},
        warn: () => {},
        error: () => {},
      }),
    }

    const t0 = Date.now()
    try {
      const response = await provider.chatCompletions(openaiReq, ctx)
      const latency = Date.now() - t0

      // Update request as completed
      await opts.db
        .updateTable("requests")
        .set({
          status: "completed",
          finished_at: new Date().toISOString(),
          latency_ms: latency,
          final_provider_id: routing.selectedProviderId,
          final_model_id: routing.selectedModelId,
        })
        .where("id", "=", reqId)
        .execute()

      return response
    } catch (err) {
      const latency = Date.now() - t0
      await opts.db
        .updateTable("requests")
        .set({
          status: "error",
          finished_at: new Date().toISOString(),
          latency_ms: latency,
          error: String(err),
        })
        .where("id", "=", reqId)
        .execute()

      return c.json({ error: String(err) }, 500)
    }
  })

  return app
}
