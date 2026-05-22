import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Hono } from "hono"
import { routeProfileRoutes } from "../src/routes/route-profiles.js"
import { setupTestDb } from "@opengate/db/test-utils"

describe("route profile endpoints", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>
  let app: Hono

  beforeAll(async () => {
    db = await setupTestDb()
    const parent = new Hono()
    parent.route("/c/:profileSlug/v1", routeProfileRoutes({ db }))
    app = parent
  })

  afterAll(async () => {
    await db.destroy()
  })

  it("lists models for default profile", async () => {
    const req = new Request("http://localhost/c/default/v1/models")
    const res = await app.fetch(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.object).toBe("list")
    expect(json.data[0].id).toBe("builder")
  })

  it("returns 404 for unknown profile", async () => {
    const req = new Request("http://localhost/c/unknown/v1/models")
    const res = await app.fetch(req)
    expect(res.status).toBe(404)
  })

  it("routes chat through static provider by default", async () => {
    const req = new Request("http://localhost/c/default/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "builder", messages: [{ role: "user", content: "hello" }] }),
    })
    const res = await app.fetch(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.choices?.[0]?.message?.content).toContain("Echo")

    const routingEvents = await db
      .selectFrom("routing_events")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(1)
      .execute()

    expect(routingEvents[0].reason).toBe("Default expert provider/model")
  })

  it("routes chat through proxy provider on keyword override", async () => {
    // Create a proxy provider and a model for it
    const { randomUUID } = await import("node:crypto")
    const proxyProviderId = randomUUID()
    const proxyModelId = randomUUID()
    const profileId = (
      await db.selectFrom("route_profiles").select("id").where("slug", "=", "default").executeTakeFirst()
    )!.id
    const expertId = (
      await db.selectFrom("experts").select("id").where("name", "=", "builder").executeTakeFirst()
    )!.id

    await db
      .insertInto("providers")
      .values({
        id: proxyProviderId,
        route_profile_id: profileId,
        name: "gemini-proxy",
        type: "proxy",
        adapter: "openai",
        protocol: "openai",
        base_url: "http://localhost:9876/openai",
        auth_type: null,
        allow_invalid_certificates: 0,
        enabled: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    await db
      .insertInto("provider_models")
      .values({
        id: proxyModelId,
        provider_id: proxyProviderId,
        model_id: "gemini-pro",
        display_name: "Gemini Pro",
        context_window: 32768,
        enabled: 1,
        discovered_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()

    await db
      .insertInto("expert_keywords")
      .values({
        id: randomUUID(),
        expert_id: expertId,
        keyword: "Gemini",
        description: "Route to Gemini",
        enabled: 1,
      })
      .execute()

    await db
      .insertInto("keyword_overrides")
      .values({
        id: randomUUID(),
        expert_id: expertId,
        keyword: "Gemini",
        provider_id: proxyProviderId,
        model_id: proxyModelId,
        priority: 1,
        enabled: 1,
      })
      .execute()

    const req = new Request("http://localhost/c/default/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "builder", messages: [{ role: "user", content: "Use Gemini please" }] }),
    })
    const res = await app.fetch(req)

    // Proxy not actually running so request will error out, but routing should have happened
    expect(res.status === 400 || res.status >= 500).toBe(true)

    const routingEvents = await db
      .selectFrom("routing_events")
      .selectAll()
      .orderBy("created_at", "desc")
      .limit(1)
      .execute()

    const ev = routingEvents[0]
    expect(ev.reason).toBe("Keyword override: Gemini")
    expect(ev.selected_provider_id).toBe(proxyProviderId)
    expect(ev.selected_model_id).toBe(proxyModelId)
  })
})
