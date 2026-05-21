import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import type { RoutingDecision } from "@opengate/shared"

export interface ResolveOptions {
  db: Kysely<Database>
  profileId: string
  modelName: string
  userMessageText: string
}

export async function resolveRouting(
  opts: ResolveOptions,
): Promise<RoutingDecision | null> {
  const expert = await opts.db
    .selectFrom("experts")
    .select([
      "id",
      "name",
      "system_prompt",
      "provider_id",
      "model_id",
    ])
    .where("route_profile_id", "=", opts.profileId)
    .where("name", "=", opts.modelName)
    .where("enabled", "=", 1)
    .executeTakeFirst()

  if (!expert) return null

  const keywords = await opts.db
    .selectFrom("expert_keywords")
    .select(["keyword", "description"])
    .where("expert_id", "=", expert.id)
    .where("enabled", "=", 1)
    .execute()

  const detected = keywords
    .filter((k: { keyword: string }) =>
      opts.userMessageText.toLowerCase().includes(k.keyword.toLowerCase()),
    )
    .map((k: { keyword: string }) => k.keyword)

  let override = null
  if (detected.length > 0) {
    override = await opts.db
      .selectFrom("keyword_overrides")
      .select(["provider_id", "model_id", "keyword", "priority"])
      .where("expert_id", "=", expert.id)
      .where("keyword", "in", detected)
      .where("enabled", "=", 1)
      .orderBy("priority", "asc")
      .executeTakeFirst()
  }

  const systemPromptEnrichment = detected.length
    ? `Relevant domains: ${detected.join(", ")}.`
    : undefined

  return {
    expertName: expert.name,
    detectedKeywords: detected,
    selectedProviderId: override?.provider_id ?? expert.provider_id,
    selectedModelId: override?.model_id ?? expert.model_id,
    overrideKeyword: override?.keyword,
    reason: override
      ? `Keyword override: ${override.keyword}`
      : "Default expert provider/model",
    systemPromptEnrichment,
  }
}
