import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const tables = [
  { name: "settings", cols: [{ name: "key", type: "text", pk: true }, { name: "value_json", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "presets", cols: [{ name: "id", type: "text", pk: true }, { name: "name", type: "text", nn: true }, { name: "description", type: "text" }, { name: "seed_version", type: "integer", nn: true }, { name: "config_json", type: "text", nn: true }, { name: "created_at", type: "text", nn: true }] },
  { name: "route_profiles", cols: [{ name: "id", type: "text", pk: true }, { name: "slug", type: "text", nn: true, u: true }, { name: "name", type: "text", nn: true }, { name: "description", type: "text" }, { name: "source_preset_id", type: "text", ref: "presets.id" }, { name: "is_default", type: "integer", nn: true }, { name: "created_at", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "project_bindings", cols: [{ name: "id", type: "text", pk: true }, { name: "route_profile_id", type: "text", nn: true, ref: "route_profiles.id" }, { name: "project_root", type: "text", nn: true, u: true }, { name: "project_name", type: "text", nn: true }, { name: "marker_path", type: "text", nn: true }, { name: "created_at", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "providers", cols: [{ name: "id", type: "text", pk: true }, { name: "route_profile_id", type: "text", nn: true, ref: "route_profiles.id" }, { name: "name", type: "text", nn: true }, { name: "type", type: "text", nn: true }, { name: "adapter", type: "text" }, { name: "protocol", type: "text", nn: true }, { name: "base_url", type: "text" }, { name: "auth_type", type: "text" }, { name: "allow_invalid_certificates", type: "integer", nn: true }, { name: "enabled", type: "integer", nn: true }, { name: "created_at", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "provider_models", cols: [{ name: "id", type: "text", pk: true }, { name: "provider_id", type: "text", nn: true, ref: "providers.id" }, { name: "model_id", type: "text", nn: true }, { name: "display_name", type: "text" }, { name: "context_window", type: "integer" }, { name: "enabled", type: "integer", nn: true }, { name: "discovered_at", type: "text" }, { name: "created_at", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "experts", cols: [{ name: "id", type: "text", pk: true }, { name: "route_profile_id", type: "text", nn: true, ref: "route_profiles.id" }, { name: "name", type: "text", nn: true }, { name: "display_name", type: "text" }, { name: "provider_id", type: "text", nn: true, ref: "providers.id" }, { name: "model_id", type: "text", nn: true, ref: "provider_models.id" }, { name: "system_prompt", type: "text", nn: true }, { name: "temperature", type: "real" }, { name: "max_tokens", type: "integer" }, { name: "expose_as_model", type: "integer", nn: true }, { name: "enabled", type: "integer", nn: true }, { name: "created_at", type: "text", nn: true }, { name: "updated_at", type: "text", nn: true }] },
  { name: "expert_keywords", cols: [{ name: "id", type: "text", pk: true }, { name: "expert_id", type: "text", nn: true, ref: "experts.id" }, { name: "keyword", type: "text", nn: true }, { name: "description", type: "text" }, { name: "enabled", type: "integer", nn: true }] },
  { name: "keyword_overrides", cols: [{ name: "id", type: "text", pk: true }, { name: "expert_id", type: "text", nn: true, ref: "experts.id" }, { name: "keyword", type: "text", nn: true }, { name: "provider_id", type: "text", nn: true, ref: "providers.id" }, { name: "model_id", type: "text", nn: true, ref: "provider_models.id" }, { name: "priority", type: "integer", nn: true }, { name: "enabled", type: "integer", nn: true }] },
  { name: "requests", cols: [{ name: "id", type: "text", pk: true }, { name: "route_profile_id", type: "text", nn: true, ref: "route_profiles.id" }, { name: "requested_model", type: "text", nn: true }, { name: "final_provider_id", type: "text" }, { name: "final_model_id", type: "text" }, { name: "status", type: "text", nn: true }, { name: "started_at", type: "text", nn: true }, { name: "finished_at", type: "text" }, { name: "latency_ms", type: "integer" }, { name: "prompt_tokens", type: "integer" }, { name: "completion_tokens", type: "integer" }, { name: "total_tokens", type: "integer" }, { name: "error", type: "text" }] },
  { name: "routing_events", cols: [{ name: "id", type: "text", pk: true }, { name: "request_id", type: "text", nn: true, ref: "requests.id" }, { name: "expert_name", type: "text", nn: true }, { name: "detected_keywords_json", type: "text", nn: true }, { name: "selected_provider_id", type: "text" }, { name: "selected_model_id", type: "text" }, { name: "override_keyword", type: "text" }, { name: "reason", type: "text", nn: true }, { name: "created_at", type: "text", nn: true }] },
  { name: "logs", cols: [{ name: "id", type: "text", pk: true }, { name: "request_id", type: "text", ref: "requests.id" }, { name: "level", type: "text", nn: true }, { name: "service", type: "text", nn: true }, { name: "message", type: "text", nn: true }, { name: "data_json", type: "text" }, { name: "created_at", type: "text", nn: true }] },
]

function colLine(c) {
  const parts = [c.name, c.type]
  if (c.pk) parts.push("PK")
  if (c.nn) parts.push("NOT NULL")
  if (c.u) parts.push("UNIQUE")
  if (c.ref) parts.push(`FK → ${c.ref}`)
  return `  - ${parts.join(" ")}`
}

const md = ["# Database Schema\n"]
for (const t of tables) {
  md.push(`## ${t.name}\n`)
  for (const c of t.cols) md.push(colLine(c))
  md.push("")
}

const outDir = join(process.cwd(), "docs", "database")
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "schema.md"), md.join("\n"))
console.log("Generated docs/database/schema.md")
