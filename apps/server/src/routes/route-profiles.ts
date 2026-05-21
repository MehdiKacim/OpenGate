import { Hono } from "hono"
import { randomUUID } from "node:crypto"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import { createStaticProvider } from "@opengate/providers"
import { resolveRouting } from "@opengate/routing"

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

    const body = await c.req.json().catch(() => null)
    if (!body) {
      return c.json({ error: "Invalid JSON body" }, 400)
    }

    const modelName = String(body.model || "")
    if (!modelName) {
      return c.json({ error: "Missing model" }, 400)
    }

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
      body.messages?.find((m: { role: string; content?: string }) => m.role === "user")
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

    // Fetch expert for system prompt and provider details
    const expert = await opts.db
      .selectFrom("experts")
      .innerJoin("providers", "providers.id", "experts.provider_id")
      .innerJoin("provider_models", "provider_models.id", "experts.model_id")
      .select([
        "experts.system_prompt",
        "experts.temperature",
        "experts.max_tokens",
        "providers.type as provider_type",
        "provider_models.model_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
      .where("experts.name", "=", modelName)
      .where("experts.enabled", "=", 1)
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
      model: expert.model_id,
      messages: [
        ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
        ...(body.messages || []),
      ],
      stream: body.stream === true,
      temperature: expert.temperature ?? body.temperature,
      max_tokens: expert.max_tokens ?? body.max_tokens,
    }

    // For MVP, always use static provider. In future, resolve provider by type.
    const provider = createStaticProvider()

    const ctx = {
      reqId,
      providerId: routing.selectedProviderId,
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
