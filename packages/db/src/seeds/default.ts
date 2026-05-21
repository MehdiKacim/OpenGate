import { type Kysely } from "kysely"
import { randomUUID } from "node:crypto"
import type { Database } from "../schema.js"

export async function seedDefaults(db: Kysely<Database>): Promise<void> {
  const existingProfile = await db
    .selectFrom("route_profiles")
    .select("id")
    .where("slug", "=", "default")
    .executeTakeFirst()

  if (existingProfile) {
    return
  }

  const profileId = randomUUID()
  const providerId = randomUUID()
  const modelId = randomUUID()
  const expertId = randomUUID()

  await db
    .insertInto("route_profiles")
    .values({
      id: profileId,
      slug: "default",
      name: "Default",
      description: "Default route profile",
      source_preset_id: null,
      is_default: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute()

  await db
    .insertInto("providers")
    .values({
      id: providerId,
      route_profile_id: profileId,
      name: "static",
      type: "static",
      adapter: "static",
      protocol: "openai",
      base_url: null,
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
      id: modelId,
      provider_id: providerId,
      model_id: "static-echo",
      display_name: "Static Echo",
      context_window: 4096,
      enabled: 1,
      discovered_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute()

  await db
    .insertInto("experts")
    .values({
      id: expertId,
      route_profile_id: profileId,
      name: "builder",
      display_name: "Builder",
      provider_id: providerId,
      model_id: modelId,
      system_prompt:
        "You are a helpful assistant focused on building and implementing features.",
      temperature: 0.7,
      max_tokens: 2048,
      expose_as_model: 1,
      enabled: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .execute()

  await db
    .insertInto("settings")
    .values({
      key: "default_profile_slug",
      value_json: JSON.stringify("default"),
      updated_at: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column("key").doUpdateSet({
        value_json: JSON.stringify("default"),
        updated_at: new Date().toISOString(),
      }),
    )
    .execute()
}
