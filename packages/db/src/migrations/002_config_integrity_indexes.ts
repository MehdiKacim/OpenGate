import type { Kysely } from "kysely"
import type { Database } from "../schema.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createIndex("providers_route_profile_name_unique")
    .unique()
    .on("providers")
    .columns(["route_profile_id", "name"])
    .execute()

  await db.schema
    .createIndex("provider_models_provider_model_id_unique")
    .unique()
    .on("provider_models")
    .columns(["provider_id", "model_id"])
    .execute()

  await db.schema
    .createIndex("experts_route_profile_name_unique")
    .unique()
    .on("experts")
    .columns(["route_profile_id", "name"])
    .execute()

  await db.schema
    .createIndex("expert_keywords_expert_keyword_unique")
    .unique()
    .on("expert_keywords")
    .columns(["expert_id", "keyword"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  for (const indexName of [
    "expert_keywords_expert_keyword_unique",
    "experts_route_profile_name_unique",
    "provider_models_provider_model_id_unique",
    "providers_route_profile_name_unique",
  ]) {
    await db.schema.dropIndex(indexName).ifExists().execute()
  }
}
