import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Hono } from "hono"
import { setupTestDb } from "@opengate/db/test-utils"
import { internalRoutes } from "../src/routes/internal.js"

describe("internal provider auth endpoints", () => {
  let app: Hono
  let authDir: string
  let providerId: string
  let db: Awaited<ReturnType<typeof setupTestDb>>
  const previousAuthPath = process.env.OPENGATE_AUTH_PATH

  beforeAll(async () => {
    authDir = await mkdtemp(join(tmpdir(), "opengate-auth-"))
    process.env.OPENGATE_AUTH_PATH = join(authDir, "auth.json")
    db = await setupTestDb()
    app = new Hono().route("/_opengate", internalRoutes({ db }))

    const profile = await db
      .selectFrom("route_profiles")
      .select("id")
      .where("slug", "=", "default")
      .executeTakeFirstOrThrow()
    providerId = randomUUID()
    await db
      .insertInto("providers")
      .values({
        id: providerId,
        route_profile_id: profile.id,
        name: "kimi-ui",
        type: "oauth",
        adapter: "kimi",
        protocol: "openai",
        base_url: null,
        auth_type: null,
        allow_invalid_certificates: 0,
        enabled: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .execute()
  })

  afterAll(async () => {
    await db.destroy()
    if (previousAuthPath === undefined) delete process.env.OPENGATE_AUTH_PATH
    else process.env.OPENGATE_AUTH_PATH = previousAuthPath
    await rm(authDir, { recursive: true, force: true })
  })

  it("stores OAuth auth from the UI API without returning secrets", async () => {
    const save = await app.fetch(
      new Request(`http://localhost/_opengate/providers/${providerId}/auth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accessToken: "secret-access",
          refreshToken: "secret-refresh",
          baseUrl: "https://api.kimi.com/coding/v1",
        }),
      }),
    )
    const saved = await save.json()

    expect(save.status).toBe(200)
    expect(saved.configured).toBe(true)
    expect(JSON.stringify(saved)).not.toContain("secret-access")
    expect(JSON.stringify(saved)).not.toContain("secret-refresh")

    const status = await app.fetch(new Request(`http://localhost/_opengate/providers/${providerId}/auth`))
    const json = await status.json()

    expect(status.status).toBe(200)
    expect(json).toMatchObject({
      adapter: "kimi",
      configured: true,
      has_access_token: true,
      has_refresh_token: true,
    })
    expect(JSON.stringify(json)).not.toContain("secret-")
  })

  it("rejects auth writes without a credential secret", async () => {
    const res = await app.fetch(
      new Request(`http://localhost/_opengate/providers/${providerId}/auth`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ baseUrl: "https://example.test" }),
      }),
    )

    expect(res.status).toBe(400)
  })
})
