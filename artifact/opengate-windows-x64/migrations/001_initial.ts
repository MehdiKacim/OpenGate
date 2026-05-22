import { type Kysely, sql } from "kysely"
import type { Database } from "../schema.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("settings")
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("value_json", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("presets")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("seed_version", "integer", (col) => col.notNull())
    .addColumn("config_json", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("route_profiles")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("source_preset_id", "text", (col) =>
      col.references("presets.id"),
    )
    .addColumn("is_default", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("project_bindings")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("route_profile_id", "text", (col) =>
      col.notNull().references("route_profiles.id").onDelete("cascade"),
    )
    .addColumn("project_root", "text", (col) => col.notNull().unique())
    .addColumn("project_name", "text", (col) => col.notNull())
    .addColumn("marker_path", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("providers")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("route_profile_id", "text", (col) =>
      col.notNull().references("route_profiles.id").onDelete("cascade"),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("adapter", "text")
    .addColumn("protocol", "text", (col) => col.notNull().defaultTo("openai"))
    .addColumn("base_url", "text")
    .addColumn("auth_type", "text")
    .addColumn("allow_invalid_certificates", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("provider_models")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("provider_id", "text", (col) =>
      col.notNull().references("providers.id").onDelete("cascade"),
    )
    .addColumn("model_id", "text", (col) => col.notNull())
    .addColumn("display_name", "text")
    .addColumn("context_window", "integer")
    .addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("discovered_at", "text")
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("experts")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("route_profile_id", "text", (col) =>
      col.notNull().references("route_profiles.id").onDelete("cascade"),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("display_name", "text")
    .addColumn("provider_id", "text", (col) =>
      col.notNull().references("providers.id"),
    )
    .addColumn("model_id", "text", (col) =>
      col.notNull().references("provider_models.id"),
    )
    .addColumn("system_prompt", "text", (col) => col.notNull())
    .addColumn("temperature", "real")
    .addColumn("max_tokens", "integer")
    .addColumn("expose_as_model", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("expert_keywords")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("expert_id", "text", (col) =>
      col.notNull().references("experts.id").onDelete("cascade"),
    )
    .addColumn("keyword", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
    .execute()

  await db.schema
    .createTable("keyword_overrides")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("expert_id", "text", (col) =>
      col.notNull().references("experts.id").onDelete("cascade"),
    )
    .addColumn("keyword", "text", (col) => col.notNull())
    .addColumn("provider_id", "text", (col) =>
      col.notNull().references("providers.id"),
    )
    .addColumn("model_id", "text", (col) =>
      col.notNull().references("provider_models.id"),
    )
    .addColumn("priority", "integer", (col) => col.notNull().defaultTo(100))
    .addColumn("enabled", "integer", (col) => col.notNull().defaultTo(1))
    .execute()

  await db.schema
    .createTable("requests")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("route_profile_id", "text", (col) =>
      col.notNull().references("route_profiles.id"),
    )
    .addColumn("requested_model", "text", (col) => col.notNull())
    .addColumn("final_provider_id", "text")
    .addColumn("final_model_id", "text")
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("started_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn("finished_at", "text")
    .addColumn("latency_ms", "integer")
    .addColumn("prompt_tokens", "integer")
    .addColumn("completion_tokens", "integer")
    .addColumn("total_tokens", "integer")
    .addColumn("error", "text")
    .execute()

  await db.schema
    .createTable("routing_events")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("request_id", "text", (col) =>
      col.notNull().references("requests.id").onDelete("cascade"),
    )
    .addColumn("expert_name", "text", (col) => col.notNull())
    .addColumn("detected_keywords_json", "text", (col) => col.notNull())
    .addColumn("selected_provider_id", "text")
    .addColumn("selected_model_id", "text")
    .addColumn("override_keyword", "text")
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable("logs")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("request_id", "text", (col) =>
      col.references("requests.id").onDelete("set null"),
    )
    .addColumn("level", "text", (col) => col.notNull())
    .addColumn("service", "text", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("data_json", "text")
    .addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  const tables = [
    "logs",
    "routing_events",
    "requests",
    "keyword_overrides",
    "expert_keywords",
    "experts",
    "provider_models",
    "providers",
    "project_bindings",
    "route_profiles",
    "presets",
    "settings",
  ] as const

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute()
  }
}
