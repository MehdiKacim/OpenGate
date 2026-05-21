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
})
