import { describe, it, expect, beforeEach } from "vitest"
import { setupTestDb } from "../src/test-utils.js"

describe("migrations", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>

  beforeEach(async () => {
    db = await setupTestDb()
  })

  it("creates expected tables via raw query", async () => {
    const result = await db.introspection.getTables()
    const names = result.map((t) => t.name).sort()
    expect(names).toContain("settings")
    expect(names).toContain("route_profiles")
    expect(names).toContain("experts")
    expect(names).toContain("requests")
    expect(names).toContain("routing_events")
    expect(names).toContain("logs")
  })

  it("seeds default route profile", async () => {
    const profile = await db
      .selectFrom("route_profiles")
      .selectAll()
      .where("slug", "=", "default")
      .executeTakeFirst()

    expect(profile).toBeDefined()
    expect(profile?.name).toBe("Default")
    expect(profile?.is_default).toBe(1)
  })

  it("seeds builder expert", async () => {
    const expert = await db
      .selectFrom("experts")
      .selectAll()
      .where("name", "=", "builder")
      .executeTakeFirst()

    expect(expert).toBeDefined()
    expect(expert?.system_prompt).toContain("building")
  })
})
