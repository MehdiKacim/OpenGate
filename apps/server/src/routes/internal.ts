import { Hono } from "hono"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"

export interface InternalRouteOptions {
  db: Kysely<Database>
}

export function internalRoutes(opts: InternalRouteOptions) {
  const app = new Hono()

  // List all route profiles
  app.get("/route-profiles", async (c) => {
    const profiles = await opts.db
      .selectFrom("route_profiles")
      .leftJoin("presets", "presets.id", "route_profiles.source_preset_id")
      .select([
        "route_profiles.id",
        "route_profiles.slug",
        "route_profiles.name",
        "route_profiles.description",
        "route_profiles.is_default",
        "presets.name as preset_name",
      ])
      .orderBy("route_profiles.created_at", "desc")
      .execute()
    return c.json({ data: profiles })
  })

  // Get resolved config for a route profile
  app.get("/route-profiles/:slug/resolved", async (c) => {
    const slug = c.req.param("slug")
    const profile = await opts.db
      .selectFrom("route_profiles")
      .select(["id", "slug", "name", "description", "is_default"])
      .where("slug", "=", slug)
      .executeTakeFirst()

    if (!profile) {
      return c.json({ error: "Route profile not found" }, 404)
    }

    const experts = await opts.db
      .selectFrom("experts")
      .leftJoin("providers", "providers.id", "experts.provider_id")
      .leftJoin("provider_models", "provider_models.id", "experts.model_id")
      .select([
        "experts.id",
        "experts.name",
        "experts.display_name",
        "experts.system_prompt",
        "experts.temperature",
        "experts.max_tokens",
        "providers.name as provider_name",
        "provider_models.model_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
      .where("experts.enabled", "=", 1)
      .execute()

    const keywords = await opts.db
      .selectFrom("expert_keywords")
      .innerJoin("experts", "experts.id", "expert_keywords.expert_id")
      .select([
        "expert_keywords.id",
        "expert_keywords.keyword",
        "expert_keywords.description",
        "experts.name as expert_name",
      ])
      .where("experts.route_profile_id", "=", profile.id)
      .where("expert_keywords.enabled", "=", 1)
      .execute()

    const overrides = await opts.db
      .selectFrom("keyword_overrides")
      .innerJoin("experts", "experts.id", "keyword_overrides.expert_id")
      .leftJoin("providers", "providers.id", "keyword_overrides.provider_id")
      .leftJoin("provider_models", "provider_models.id", "keyword_overrides.model_id")
      .select([
        "keyword_overrides.id",
        "keyword_overrides.keyword",
        "keyword_overrides.priority",
        "experts.name as expert_name",
        "providers.name as provider_name",
        "provider_models.model_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
      .where("keyword_overrides.enabled", "=", 1)
      .execute()

    return c.json({
      profile,
      experts,
      keywords,
      overrides,
    })
  })

  // List providers for a route profile
  app.get("/route-profiles/:slug/providers", async (c) => {
    const slug = c.req.param("slug")
    const profile = await opts.db
      .selectFrom("route_profiles")
      .select("id")
      .where("slug", "=", slug)
      .executeTakeFirst()

    if (!profile) {
      return c.json({ error: "Route profile not found" }, 404)
    }

    const providers = await opts.db
      .selectFrom("providers")
      .select(["id", "name", "type", "protocol", "base_url", "enabled"])
      .where("route_profile_id", "=", profile.id)
      .execute()

    const models = await opts.db
      .selectFrom("provider_models")
      .select(["id", "provider_id", "model_id", "display_name", "enabled"])
      .where("provider_id", "in", providers.map((p) => p.id))
      .execute()

    return c.json({ providers, models })
  })

  // List presets
  app.get("/presets", async (c) => {
    const presets = await opts.db
      .selectFrom("presets")
      .select(["id", "name", "description", "seed_version"])
      .execute()
    return c.json({ data: presets })
  })

  // Copy preset into route profile
  app.post("/presets/:id/copy", async (c) => {
    const presetId = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const targetSlug = body.slug || presetId
    const targetName = body.name || targetSlug

    const preset = await opts.db
      .selectFrom("presets")
      .select(["id", "config_json"])
      .where("id", "=", presetId)
      .executeTakeFirst()

    if (!preset) {
      return c.json({ error: "Preset not found" }, 404)
    }

    const existing = await opts.db
      .selectFrom("route_profiles")
      .select("id")
      .where("slug", "=", targetSlug)
      .executeTakeFirst()

    if (existing) {
      return c.json({ error: `Route profile slug already exists: ${targetSlug}` }, 409)
    }

    const { randomUUID } = await import("node:crypto")
    const profileId = randomUUID()

    await opts.db
      .insertInto("route_profiles")
      .values({
        id: profileId,
        slug: targetSlug,
        name: targetName,
        description: `Copied from preset ${presetId}`,
        source_preset_id: presetId,
        is_default: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    return c.json({ id: profileId, slug: targetSlug, message: "Preset copied to route profile" }, 201)
  })

  // List recent routing events
  app.get("/logs", async (c) => {
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200)
    const events = await opts.db
      .selectFrom("routing_events")
      .leftJoin("requests", "requests.id", "routing_events.request_id")
      .select([
        "routing_events.id",
        "routing_events.request_id",
        "routing_events.expert_name",
        "routing_events.detected_keywords_json",
        "routing_events.override_keyword",
        "routing_events.reason",
        "routing_events.created_at",
        "requests.status",
        "requests.latency_ms",
      ])
      .orderBy("routing_events.created_at", "desc")
      .limit(limit)
      .execute()

    return c.json({
      data: events.map((e) => ({
        ...e,
        detected_keywords: JSON.parse(e.detected_keywords_json || "[]"),
      })),
    })
  })

  // Playground: test a prompt
  app.post("/playground", async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || !body.profileSlug || !body.model || !body.messages) {
      return c.json({ error: "Missing profileSlug, model or messages" }, 400)
    }

    // Forward to the chat completions endpoint
    const url = new URL(c.req.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const resp = await fetch(`${baseUrl}/c/${body.profileSlug}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        stream: false,
      }),
    })

    const data = await resp.json()
    return c.json(data, resp.status as any)
  })

  return app
}
