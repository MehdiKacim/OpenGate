import { Hono } from "hono"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import {
  deleteAuthRecord,
  FileOAuthAuthStore,
  saveAuthRecord,
  type OAuthAdapterName,
  type OAuthAuthRecord,
  type OAuthProviderRef,
} from "@opengate/providers"
import { randomUUID } from "node:crypto"

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
        "experts.expose_as_model",
        "experts.enabled",
        "providers.id as provider_id",
        "providers.name as provider_name",
        "provider_models.id as model_id",
        "provider_models.model_id as model_external_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
      .execute()

    const keywords = await opts.db
      .selectFrom("expert_keywords")
      .innerJoin("experts", "experts.id", "expert_keywords.expert_id")
      .select([
        "expert_keywords.id",
        "expert_keywords.keyword",
        "expert_keywords.description",
        "expert_keywords.enabled",
        "experts.name as expert_name",
        "experts.id as expert_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
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
        "keyword_overrides.enabled",
        "experts.name as expert_name",
        "experts.id as expert_id",
        "providers.id as provider_id",
        "providers.name as provider_name",
        "provider_models.id as model_id",
        "provider_models.model_id as model_external_id",
      ])
      .where("experts.route_profile_id", "=", profile.id)
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
      .select(["id", "name", "type", "adapter", "protocol", "base_url", "auth_type", "allow_invalid_certificates", "enabled"])
      .where("route_profile_id", "=", profile.id)
      .execute()

    const models = await opts.db
      .selectFrom("provider_models")
      .select(["id", "provider_id", "model_id", "display_name", "context_window", "enabled"])
      .where("provider_id", "in", providers.map((p) => p.id))
      .execute()

    return c.json({ providers, models })
  })

  // Create provider
  app.post("/route-profiles/:slug/providers", async (c) => {
    const slug = c.req.param("slug")
    const profile = await opts.db.selectFrom("route_profiles").select("id").where("slug", "=", slug).executeTakeFirst()
    if (!profile) return c.json({ error: "Route profile not found" }, 404)

    const body = await c.req.json().catch(() => null)
    if (!body || !body.name || !body.type) {
      return c.json({ error: "Missing name or type" }, 400)
    }

    const id = randomUUID()
    await opts.db
      .insertInto("providers")
      .values({
        id,
        route_profile_id: profile.id,
        name: body.name,
        type: body.type,
        adapter: body.adapter ?? null,
        protocol: body.protocol ?? "openai",
        base_url: body.base_url ?? null,
        auth_type: body.auth_type ?? null,
        allow_invalid_certificates: body.allow_invalid_certificates ? 1 : 0,
        enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    return c.json({ id }, 201)
  })

  // Update provider
  app.patch("/providers/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const setFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) setFields.name = body.name
    if (body.type !== undefined) setFields.type = body.type
    if (body.adapter !== undefined) setFields.adapter = body.adapter
    if (body.protocol !== undefined) setFields.protocol = body.protocol
    if (body.base_url !== undefined) setFields.base_url = body.base_url
    if (body.auth_type !== undefined) setFields.auth_type = body.auth_type
    if (body.allow_invalid_certificates !== undefined) setFields.allow_invalid_certificates = body.allow_invalid_certificates ? 1 : 0
    if (body.enabled !== undefined) setFields.enabled = body.enabled ? 1 : 0

    await opts.db.updateTable("providers").set(setFields).where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Store provider OAuth secrets outside route profiles.
  app.get("/providers/:id/auth", async (c) => {
    const lookup = await getOAuthProviderRef(opts.db, c.req.param("id"))
    if ("error" in lookup) return c.json({ error: lookup.error }, lookup.status)

    const record = await new FileOAuthAuthStore().load(lookup.ref)
    return c.json({ provider_id: lookup.ref.id, adapter: lookup.ref.adapter, ...authStatus(record) })
  })

  app.post("/providers/:id/auth", async (c) => {
    const lookup = await getOAuthProviderRef(opts.db, c.req.param("id"))
    if ("error" in lookup) return c.json({ error: lookup.error }, lookup.status)

    const body = await c.req.json().catch(() => null)
    const record = authRecordFromBody(body)
    if (!record) {
      return c.json(
        { error: "Add at least one access token, refresh token, or session token for this OAuth provider." },
        400,
      )
    }

    await saveAuthRecord(lookup.ref, record)
    return c.json({ provider_id: lookup.ref.id, adapter: lookup.ref.adapter, ...authStatus(record) })
  })

  app.delete("/providers/:id/auth", async (c) => {
    const lookup = await getOAuthProviderRef(opts.db, c.req.param("id"))
    if ("error" in lookup) return c.json({ error: lookup.error }, lookup.status)

    const deleted = await deleteAuthRecord(lookup.ref)
    return c.json({ ok: true, deleted })
  })

  // Delete provider
  app.delete("/providers/:id", async (c) => {
    const id = c.req.param("id")
    await opts.db.deleteFrom("providers").where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Create model under provider
  app.post("/providers/:id/models", async (c) => {
    const providerId = c.req.param("id")
    const body = await c.req.json().catch(() => null)
    if (!body || !body.model_id) return c.json({ error: "Missing model_id" }, 400)

    const id = randomUUID()
    await opts.db
      .insertInto("provider_models")
      .values({
        id,
        provider_id: providerId,
        model_id: body.model_id,
        display_name: body.display_name ?? null,
        context_window: body.context_window ?? null,
        enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
        discovered_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    return c.json({ id }, 201)
  })

  // Update model
  app.patch("/provider-models/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const setFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.model_id !== undefined) setFields.model_id = body.model_id
    if (body.display_name !== undefined) setFields.display_name = body.display_name
    if (body.context_window !== undefined) setFields.context_window = body.context_window
    if (body.enabled !== undefined) setFields.enabled = body.enabled ? 1 : 0

    await opts.db.updateTable("provider_models").set(setFields).where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Delete model
  app.delete("/provider-models/:id", async (c) => {
    const id = c.req.param("id")
    await opts.db.deleteFrom("provider_models").where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Create expert
  app.post("/route-profiles/:slug/experts", async (c) => {
    const slug = c.req.param("slug")
    const profile = await opts.db.selectFrom("route_profiles").select("id").where("slug", "=", slug).executeTakeFirst()
    if (!profile) return c.json({ error: "Route profile not found" }, 404)

    const body = await c.req.json().catch(() => null)
    if (!body || !body.name || !body.provider_id || !body.model_id) {
      return c.json({ error: "Missing name, provider_id or model_id" }, 400)
    }

    const id = randomUUID()
    await opts.db
      .insertInto("experts")
      .values({
        id,
        route_profile_id: profile.id,
        name: body.name,
        display_name: body.display_name ?? null,
        provider_id: body.provider_id,
        model_id: body.model_id,
        system_prompt: body.system_prompt ?? "",
        temperature: body.temperature ?? null,
        max_tokens: body.max_tokens ?? null,
        expose_as_model: body.expose_as_model !== undefined ? (body.expose_as_model ? 1 : 0) : 1,
        enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    return c.json({ id }, 201)
  })

  // Update expert
  app.patch("/experts/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const setFields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) setFields.name = body.name
    if (body.display_name !== undefined) setFields.display_name = body.display_name
    if (body.provider_id !== undefined) setFields.provider_id = body.provider_id
    if (body.model_id !== undefined) setFields.model_id = body.model_id
    if (body.system_prompt !== undefined) setFields.system_prompt = body.system_prompt
    if (body.temperature !== undefined) setFields.temperature = body.temperature
    if (body.max_tokens !== undefined) setFields.max_tokens = body.max_tokens
    if (body.expose_as_model !== undefined) setFields.expose_as_model = body.expose_as_model ? 1 : 0
    if (body.enabled !== undefined) setFields.enabled = body.enabled ? 1 : 0

    await opts.db.updateTable("experts").set(setFields).where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Delete expert
  app.delete("/experts/:id", async (c) => {
    const id = c.req.param("id")
    await opts.db.deleteFrom("experts").where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Create keyword
  app.post("/experts/:id/keywords", async (c) => {
    const expertId = c.req.param("id")
    const body = await c.req.json().catch(() => null)
    if (!body || !body.keyword) return c.json({ error: "Missing keyword" }, 400)

    const id = randomUUID()
    await opts.db
      .insertInto("expert_keywords")
      .values({
        id,
        expert_id: expertId,
        keyword: body.keyword,
        description: body.description ?? null,
        enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
      })
      .execute()

    return c.json({ id }, 201)
  })

  // Update keyword
  app.patch("/expert-keywords/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const setFields: Record<string, unknown> = {}
    if (body.keyword !== undefined) setFields.keyword = body.keyword
    if (body.description !== undefined) setFields.description = body.description
    if (body.enabled !== undefined) setFields.enabled = body.enabled ? 1 : 0

    await opts.db.updateTable("expert_keywords").set(setFields).where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Delete keyword
  app.delete("/expert-keywords/:id", async (c) => {
    const id = c.req.param("id")
    await opts.db.deleteFrom("expert_keywords").where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Create keyword override
  app.post("/experts/:id/overrides", async (c) => {
    const expertId = c.req.param("id")
    const body = await c.req.json().catch(() => null)
    if (!body || !body.keyword || !body.provider_id || !body.model_id) {
      return c.json({ error: "Missing keyword, provider_id or model_id" }, 400)
    }

    const id = randomUUID()
    await opts.db
      .insertInto("keyword_overrides")
      .values({
        id,
        expert_id: expertId,
        keyword: body.keyword,
        provider_id: body.provider_id,
        model_id: body.model_id,
        priority: body.priority ?? 100,
        enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
      })
      .execute()

    return c.json({ id }, 201)
  })

  // Update keyword override
  app.patch("/keyword-overrides/:id", async (c) => {
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))
    const setFields: Record<string, unknown> = {}
    if (body.keyword !== undefined) setFields.keyword = body.keyword
    if (body.provider_id !== undefined) setFields.provider_id = body.provider_id
    if (body.model_id !== undefined) setFields.model_id = body.model_id
    if (body.priority !== undefined) setFields.priority = body.priority
    if (body.enabled !== undefined) setFields.enabled = body.enabled ? 1 : 0

    await opts.db.updateTable("keyword_overrides").set(setFields).where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Delete keyword override
  app.delete("/keyword-overrides/:id", async (c) => {
    const id = c.req.param("id")
    await opts.db.deleteFrom("keyword_overrides").where("id", "=", id).execute()
    return c.json({ ok: true })
  })

  // Graph design snapshot for a route profile
  app.get("/route-profiles/:slug/graph-design", async (c) => {
    const slug = c.req.param("slug")
    const profile = await opts.db
      .selectFrom("route_profiles")
      .select(["id", "slug", "name"])
      .where("slug", "=", slug)
      .executeTakeFirst()

    if (!profile) return c.json({ error: "Route profile not found" }, 404)

    const providers = await opts.db
      .selectFrom("providers")
      .selectAll()
      .where("route_profile_id", "=", profile.id)
      .execute()

    const models = await opts.db
      .selectFrom("provider_models")
      .selectAll()
      .where("provider_id", "in", providers.map((p) => p.id))
      .execute()

    const experts = await opts.db
      .selectFrom("experts")
      .selectAll()
      .where("route_profile_id", "=", profile.id)
      .execute()

    const keywords = await opts.db
      .selectFrom("expert_keywords")
      .selectAll()
      .where("expert_id", "in", experts.map((e) => e.id))
      .execute()

    const overrides = await opts.db
      .selectFrom("keyword_overrides")
      .selectAll()
      .where("expert_id", "in", experts.map((e) => e.id))
      .execute()

    return c.json({ profile, providers, models, experts, keywords, overrides })
  })

  // Runtime graph data for recent requests
  app.get("/route-profiles/:slug/graph-runtime", async (c) => {
    const slug = c.req.param("slug")
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200)

    const profile = await opts.db
      .selectFrom("route_profiles")
      .select("id")
      .where("slug", "=", slug)
      .executeTakeFirst()

    if (!profile) return c.json({ error: "Route profile not found" }, 404)

    const requests = await opts.db
      .selectFrom("requests")
      .leftJoin("routing_events", "routing_events.request_id", "requests.id")
      .select([
        "requests.id",
        "requests.requested_model",
        "requests.status",
        "requests.latency_ms",
        "requests.started_at",
        "requests.finished_at",
        "requests.error",
        "requests.final_provider_id",
        "requests.final_model_id",
        "routing_events.expert_name",
        "routing_events.detected_keywords_json",
        "routing_events.override_keyword",
        "routing_events.reason",
        "routing_events.selected_provider_id",
        "routing_events.selected_model_id",
      ])
      .where("requests.route_profile_id", "=", profile.id)
      .orderBy("requests.started_at", "desc")
      .limit(limit)
      .execute()

    return c.json({ data: requests })
  })

  // List presets
  app.get("/presets", async (c) => {
    const presets = await opts.db
      .selectFrom("presets")
      .select(["id", "name", "description", "seed_version"])
      .execute()
    return c.json({ data: presets })
  })

  // Copy preset into route profile — transactional full materialization
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

    let config: any
    try {
      config = JSON.parse(preset.config_json)
    } catch {
      return c.json({ error: "Preset config_json is invalid JSON" }, 500)
    }

    const profileId = randomUUID()
    const now = new Date().toISOString()

    try {
      await opts.db.transaction().execute(async (trx) => {
        // 1. Create route profile
        await trx
          .insertInto("route_profiles")
          .values({
            id: profileId,
            slug: targetSlug,
            name: targetName,
            description: `Copied from preset ${presetId}`,
            source_preset_id: presetId,
            is_default: 0,
            created_at: now,
            updated_at: now,
          })
          .execute()

        // 2. Create providers and models
        const providerNameToId = new Map<string, string>()
        const modelKeyToId = new Map<string, string>() // key = "providerName|modelExternalId"

        const providers = Array.isArray(config.providers) ? config.providers : []
        for (const p of providers) {
          const providerId = randomUUID()
          providerNameToId.set(p.name, providerId)

          await trx
            .insertInto("providers")
            .values({
              id: providerId,
              route_profile_id: profileId,
              name: p.name,
              type: p.type,
              adapter: p.adapter ?? null,
              protocol: p.protocol ?? "openai",
              base_url: p.base_url ?? null,
              auth_type: p.auth_type ?? null,
              allow_invalid_certificates: p.allow_invalid_certificates ? 1 : 0,
              enabled: p.enabled !== undefined ? (p.enabled ? 1 : 0) : 1,
              created_at: now,
              updated_at: now,
            })
            .execute()

          const models = Array.isArray(p.models) ? p.models : []
          for (const m of models) {
            const modelId = randomUUID()
            modelKeyToId.set(`${p.name}|${m.model_id}`, modelId)
            await trx
              .insertInto("provider_models")
              .values({
                id: modelId,
                provider_id: providerId,
                model_id: m.model_id,
                display_name: m.display_name ?? null,
                context_window: m.context_window ?? null,
                enabled: m.enabled !== undefined ? (m.enabled ? 1 : 0) : 1,
                discovered_at: null,
                created_at: now,
                updated_at: now,
              })
              .execute()
          }
        }

        // 3. Create experts, keywords, overrides
        const expertNameToId = new Map<string, string>()
        const experts = Array.isArray(config.experts) ? config.experts : []

        for (const e of experts) {
          const providerId = providerNameToId.get(e.provider_name)
          if (!providerId) {
            throw new Error(`Expert "${e.name}" references unknown provider "${e.provider_name}"`)
          }
          const modelId = modelKeyToId.get(`${e.provider_name}|${e.model_external_id}`)
          if (!modelId) {
            throw new Error(`Expert "${e.name}" references unknown model "${e.model_external_id}" for provider "${e.provider_name}"`)
          }

          const expertId = randomUUID()
          expertNameToId.set(e.name, expertId)

          await trx
            .insertInto("experts")
            .values({
              id: expertId,
              route_profile_id: profileId,
              name: e.name,
              display_name: e.display_name ?? null,
              provider_id: providerId,
              model_id: modelId,
              system_prompt: e.system_prompt ?? "",
              temperature: e.temperature ?? null,
              max_tokens: e.max_tokens ?? null,
              expose_as_model: e.expose_as_model !== undefined ? (e.expose_as_model ? 1 : 0) : 1,
              enabled: e.enabled !== undefined ? (e.enabled ? 1 : 0) : 1,
              created_at: now,
              updated_at: now,
            })
            .execute()

          const keywords = Array.isArray(e.keywords) ? e.keywords : []
          for (const k of keywords) {
            await trx
              .insertInto("expert_keywords")
              .values({
                id: randomUUID(),
                expert_id: expertId,
                keyword: k.keyword,
                description: k.description ?? null,
                enabled: k.enabled !== undefined ? (k.enabled ? 1 : 0) : 1,
              })
              .execute()
          }

          const overrides = Array.isArray(e.overrides) ? e.overrides : []
          for (const o of overrides) {
            const oProviderId = providerNameToId.get(o.provider_name)
            if (!oProviderId) {
              throw new Error(`Override for expert "${e.name}" references unknown provider "${o.provider_name}"`)
            }
            const oModelId = modelKeyToId.get(`${o.provider_name}|${o.model_external_id}`)
            if (!oModelId) {
              throw new Error(`Override for expert "${e.name}" references unknown model "${o.model_external_id}" for provider "${o.provider_name}"`)
            }
            await trx
              .insertInto("keyword_overrides")
              .values({
                id: randomUUID(),
                expert_id: expertId,
                keyword: o.keyword,
                provider_id: oProviderId,
                model_id: oModelId,
                priority: o.priority ?? 100,
                enabled: o.enabled !== undefined ? (o.enabled ? 1 : 0) : 1,
              })
              .execute()
          }
        }
      })

      return c.json({ id: profileId, slug: targetSlug, message: "Preset copied to route profile with full config" }, 201)
    } catch (err) {
      return c.json({ error: `Copy failed: ${String(err)}` }, 500)
    }
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

type OAuthLookup =
  | { ref: OAuthProviderRef }
  | { error: string; status: 404 | 400 }

async function getOAuthProviderRef(db: Kysely<Database>, id: string): Promise<OAuthLookup> {
  const provider = await db
    .selectFrom("providers")
    .select(["id", "name", "type", "adapter"])
    .where("id", "=", id)
    .executeTakeFirst()

  if (!provider) return { error: "Provider not found", status: 404 }
  if (provider.type !== "oauth") {
    return { error: "Local auth records are only available for OAuth providers", status: 400 }
  }
  if (!isOAuthAdapter(provider.adapter)) {
    return { error: "OAuth provider adapter must be kimi, chatgpt, or gemini", status: 400 }
  }

  return {
    ref: {
      id: provider.id,
      name: provider.name,
      adapter: provider.adapter,
    },
  }
}

function isOAuthAdapter(adapter: string | null): adapter is OAuthAdapterName {
  return adapter === "kimi" || adapter === "chatgpt" || adapter === "gemini"
}

function authRecordFromBody(body: unknown): OAuthAuthRecord | undefined {
  if (!body || typeof body !== "object") return undefined

  const source = body as Record<string, unknown>
  const record: OAuthAuthRecord = {}
  const accessToken = cleanString(source.accessToken)
  const refreshToken = cleanString(source.refreshToken)
  const sessionToken = cleanString(source.sessionToken)
  const baseUrl = cleanString(source.baseUrl)
  const accountId = cleanString(source.accountId)
  const projectId = cleanString(source.projectId)

  if (accessToken) record.accessToken = accessToken
  if (refreshToken) record.refreshToken = refreshToken
  if (sessionToken) record.sessionToken = sessionToken
  if (baseUrl) record.baseUrl = baseUrl
  if (accountId) record.accountId = accountId
  if (projectId) record.projectId = projectId

  if (typeof source.expiresAt === "number" && Number.isFinite(source.expiresAt)) {
    record.expiresAt = source.expiresAt
  }

  if (!record.accessToken && !record.refreshToken && !record.sessionToken) return undefined
  return record
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const cleaned = value.trim()
  return cleaned || undefined
}

function authStatus(record: OAuthAuthRecord | undefined) {
  const now = Date.now()
  return {
    configured: Boolean(record?.accessToken || record?.refreshToken || record?.sessionToken),
    has_access_token: Boolean(record?.accessToken),
    has_refresh_token: Boolean(record?.refreshToken),
    has_session_token: Boolean(record?.sessionToken),
    expires_at: record?.expiresAt ?? null,
    expired: typeof record?.expiresAt === "number" ? record.expiresAt <= now : null,
    base_url: record?.baseUrl ?? null,
  }
}
