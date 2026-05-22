import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { setupTestDb } from "@opengate/db/test-utils"
import { exportRouteProfile, importRouteProfile } from "../src/import-export.js"

describe("route profile OAuth import/export", () => {
  const databases: Array<Awaited<ReturnType<typeof setupTestDb>>> = []

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((db) => db.destroy()))
  })

  it("exports OAuth provider identity without secrets", async () => {
    const db = await setupDbWithOAuthProvider()
    const exported = await exportRouteProfile(db, "default")
    const encoded = JSON.stringify(exported)

    expect(encoded).toContain('"type":"oauth"')
    expect(encoded).toContain('"adapter":"kimi"')
    expect(encoded).not.toMatch(/access_token|accessToken|refresh_token|refreshToken|session|api_key|apiKey/)
    expect(exported.providers).toContainEqual(
      expect.objectContaining({
        name: "kimi",
        type: "oauth",
        adapter: "kimi",
      }),
    )
  })

  it("imports OAuth route profiles without credentials", async () => {
    const db = await trackedDb()
    const exported = {
      version: 1 as const,
      profile: {
        slug: "oauth-source",
        name: "OAuth source",
        description: null,
      },
      providers: [
        {
          name: "chatgpt",
          type: "oauth",
          adapter: "chatgpt",
          protocol: "openai",
          base_url: null,
          auth_type: null,
          allow_invalid_certificates: false,
          enabled: true,
          models: [
            {
              model_id: "gpt-5-codex",
              display_name: "GPT-5 Codex",
              context_window: null,
              enabled: true,
            },
          ],
        },
      ],
      experts: [
        {
          name: "builder",
          display_name: "Builder",
          provider_name: "chatgpt",
          model_external_id: "gpt-5-codex",
          system_prompt: "",
          temperature: null,
          max_tokens: null,
          expose_as_model: true,
          enabled: true,
          keywords: [],
          overrides: [],
        },
      ],
    }

    await expect(importRouteProfile(db, exported)).resolves.toEqual(
      expect.objectContaining({ slug: "oauth-source" }),
    )

    const roundTrip = await exportRouteProfile(db, "oauth-source")
    expect(roundTrip.providers).toContainEqual(
      expect.objectContaining({
        name: "chatgpt",
        type: "oauth",
        adapter: "chatgpt",
      }),
    )
  })

  async function setupDbWithOAuthProvider() {
    const db = await trackedDb()
    const profile = await db
      .selectFrom("route_profiles")
      .select("id")
      .where("slug", "=", "default")
      .executeTakeFirstOrThrow()
    const providerId = randomUUID()
    const now = new Date().toISOString()

    await db
      .insertInto("providers")
      .values({
        id: providerId,
        route_profile_id: profile.id,
        name: "kimi",
        type: "oauth",
        adapter: "kimi",
        protocol: "openai",
        base_url: null,
        auth_type: "local-auth-store",
        allow_invalid_certificates: 0,
        enabled: 1,
        created_at: now,
        updated_at: now,
      })
      .execute()

    await db
      .insertInto("provider_models")
      .values({
        id: randomUUID(),
        provider_id: providerId,
        model_id: "kimi-for-coding",
        display_name: "Kimi for Coding",
        context_window: null,
        enabled: 1,
        discovered_at: null,
        created_at: now,
        updated_at: now,
      })
      .execute()

    return db
  }

  async function trackedDb() {
    const db = await setupTestDb()
    databases.push(db)
    return db
  }
})
