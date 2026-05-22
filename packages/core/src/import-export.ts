import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import { randomUUID } from "node:crypto"

export interface ExportedRouteProfile {
  version: 1
  profile: {
    slug: string
    name: string
    description: string | null
  }
  providers: ExportedProvider[]
  experts: ExportedExpert[]
}

export interface ExportedProvider {
  name: string
  type: string
  adapter: string | null
  protocol: string
  base_url: string | null
  auth_type: string | null
  allow_invalid_certificates: boolean
  enabled: boolean
  models: ExportedModel[]
}

export interface ExportedModel {
  model_id: string
  display_name: string | null
  context_window: number | null
  enabled: boolean
}

export interface ExportedExpert {
  name: string
  display_name: string | null
  provider_name: string
  model_external_id: string
  system_prompt: string
  temperature: number | null
  max_tokens: number | null
  expose_as_model: boolean
  enabled: boolean
  keywords: ExportedKeyword[]
  overrides: ExportedOverride[]
}

export interface ExportedKeyword {
  keyword: string
  description: string | null
  enabled: boolean
}

export interface ExportedOverride {
  keyword: string
  provider_name: string
  model_external_id: string
  priority: number
  enabled: boolean
}

export async function exportRouteProfile(
  db: Kysely<Database>,
  slug: string,
): Promise<ExportedRouteProfile> {
  const profile = await db
    .selectFrom("route_profiles")
    .select(["id", "slug", "name", "description"])
    .where("slug", "=", slug)
    .executeTakeFirst()

  if (!profile) {
    throw new Error(`Route profile not found: ${slug}`)
  }

  const providers = await db
    .selectFrom("providers")
    .selectAll()
    .where("route_profile_id", "=", profile.id)
    .execute()

  const providerIds = providers.map((p) => p.id)

  const models = providerIds.length > 0
    ? await db
        .selectFrom("provider_models")
        .selectAll()
        .where("provider_id", "in", providerIds)
        .execute()
    : []

  const experts = await db
    .selectFrom("experts")
    .selectAll()
    .where("route_profile_id", "=", profile.id)
    .execute()

  const expertIds = experts.map((e) => e.id)

  const keywords = expertIds.length > 0
    ? await db
        .selectFrom("expert_keywords")
        .selectAll()
        .where("expert_id", "in", expertIds)
        .execute()
    : []

  const overrides = expertIds.length > 0
    ? await db
        .selectFrom("keyword_overrides")
        .selectAll()
        .where("expert_id", "in", expertIds)
        .execute()
    : []

  const providerById = new Map(providers.map((p) => [p.id, p]))
  const modelById = new Map(models.map((m) => [m.id, m]))

  const exportedProviders: ExportedProvider[] = providers.map((p) => ({
    name: p.name,
    type: p.type,
    adapter: p.adapter,
    protocol: p.protocol,
    base_url: p.base_url,
    auth_type: p.auth_type,
    allow_invalid_certificates: p.allow_invalid_certificates === 1,
    enabled: p.enabled === 1,
    models: models
      .filter((m) => m.provider_id === p.id)
      .map((m) => ({
        model_id: m.model_id,
        display_name: m.display_name,
        context_window: m.context_window,
        enabled: m.enabled === 1,
      })),
  }))

  const exportedExperts: ExportedExpert[] = experts.map((e) => {
    const provider = providerById.get(e.provider_id)
    const model = modelById.get(e.model_id)
    return {
      name: e.name,
      display_name: e.display_name,
      provider_name: provider?.name ?? "",
      model_external_id: model?.model_id ?? "",
      system_prompt: e.system_prompt,
      temperature: e.temperature,
      max_tokens: e.max_tokens,
      expose_as_model: e.expose_as_model === 1,
      enabled: e.enabled === 1,
      keywords: keywords
        .filter((k) => k.expert_id === e.id)
        .map((k) => ({
          keyword: k.keyword,
          description: k.description,
          enabled: k.enabled === 1,
        })),
      overrides: overrides
        .filter((o) => o.expert_id === e.id)
        .map((o) => {
          const oProvider = providerById.get(o.provider_id)
          const oModel = modelById.get(o.model_id)
          return {
            keyword: o.keyword,
            provider_name: oProvider?.name ?? "",
            model_external_id: oModel?.model_id ?? "",
            priority: o.priority,
            enabled: o.enabled === 1,
          }
        }),
    }
  })

  return {
    version: 1,
    profile: {
      slug: profile.slug,
      name: profile.name,
      description: profile.description,
    },
    providers: exportedProviders,
    experts: exportedExperts,
  }
}

export async function importRouteProfile(
  db: Kysely<Database>,
  data: unknown,
  options: { targetSlug?: string; overwrite?: boolean } = {},
): Promise<{ profileId: string; slug: string }> {
  const payload = validateExportPayload(data)

  const targetSlug = options.targetSlug ?? payload.profile.slug

  const existing = await db
    .selectFrom("route_profiles")
    .select("id")
    .where("slug", "=", targetSlug)
    .executeTakeFirst()

  if (existing && !options.overwrite) {
    throw new Error(`Route profile slug already exists: ${targetSlug}. Use overwrite=true to replace.`)
  }

  const profileId = randomUUID()
  const now = new Date().toISOString()

  await db.transaction().execute(async (trx) => {
    if (existing) {
      await trx.deleteFrom("route_profiles").where("id", "=", existing.id).execute()
    }

    await trx
      .insertInto("route_profiles")
      .values({
        id: profileId,
        slug: targetSlug,
        name: payload.profile.name,
        description: payload.profile.description,
        source_preset_id: null,
        is_default: 0,
        created_at: now,
        updated_at: now,
      })
      .execute()

    const providerNameToId = new Map<string, string>()
    const modelKeyToId = new Map<string, string>()

    for (const p of payload.providers) {
      const providerId = randomUUID()
      providerNameToId.set(p.name, providerId)

      await trx
        .insertInto("providers")
        .values({
          id: providerId,
          route_profile_id: profileId,
          name: p.name,
          type: p.type,
          adapter: p.adapter ?? null,
          protocol: p.protocol ?? "openai",
          base_url: p.base_url ?? null,
          auth_type: p.auth_type ?? null,
          allow_invalid_certificates: p.allow_invalid_certificates ? 1 : 0,
          enabled: p.enabled ? 1 : 0,
          created_at: now,
          updated_at: now,
        })
        .execute()

      for (const m of p.models) {
        const modelId = randomUUID()
        modelKeyToId.set(`${p.name}|${m.model_id}`, modelId)
        await trx
          .insertInto("provider_models")
          .values({
            id: modelId,
            provider_id: providerId,
            model_id: m.model_id,
            display_name: m.display_name ?? null,
            context_window: m.context_window ?? null,
            enabled: m.enabled ? 1 : 0,
            discovered_at: null,
            created_at: now,
            updated_at: now,
          })
          .execute()
      }
    }

    const expertNameToId = new Map<string, string>()

    for (const e of payload.experts) {
      const providerId = providerNameToId.get(e.provider_name)
      if (!providerId) {
        throw new Error(`Expert "${e.name}" references unknown provider "${e.provider_name}"`)
      }
      const modelId = modelKeyToId.get(`${e.provider_name}|${e.model_external_id}`)
      if (!modelId) {
        throw new Error(`Expert "${e.name}" references unknown model "${e.model_external_id}" for provider "${e.provider_name}"`)
      }

      const expertId = randomUUID()
      expertNameToId.set(e.name, expertId)

      await trx
        .insertInto("experts")
        .values({
          id: expertId,
          route_profile_id: profileId,
          name: e.name,
          display_name: e.display_name ?? null,
          provider_id: providerId,
          model_id: modelId,
          system_prompt: e.system_prompt,
          temperature: e.temperature ?? null,
          max_tokens: e.max_tokens ?? null,
          expose_as_model: e.expose_as_model ? 1 : 0,
          enabled: e.enabled ? 1 : 0,
          created_at: now,
          updated_at: now,
        })
        .execute()

      for (const k of e.keywords) {
        await trx
          .insertInto("expert_keywords")
          .values({
            id: randomUUID(),
            expert_id: expertId,
            keyword: k.keyword,
            description: k.description ?? null,
            enabled: k.enabled ? 1 : 0,
          })
          .execute()
      }

      for (const o of e.overrides) {
        const oProviderId = providerNameToId.get(o.provider_name)
        if (!oProviderId) {
          throw new Error(`Override for expert "${e.name}" references unknown provider "${o.provider_name}"`)
        }
        const oModelId = modelKeyToId.get(`${o.provider_name}|${o.model_external_id}`)
        if (!oModelId) {
          throw new Error(`Override for expert "${e.name}" references unknown model "${o.model_external_id}" for provider "${o.provider_name}"`)
        }
        await trx
          .insertInto("keyword_overrides")
          .values({
            id: randomUUID(),
            expert_id: expertId,
            keyword: o.keyword,
            provider_id: oProviderId,
            model_id: oModelId,
            priority: o.priority,
            enabled: o.enabled ? 1 : 0,
          })
          .execute()
      }
    }
  })

  return { profileId, slug: targetSlug }
}

function validateExportPayload(data: unknown): ExportedRouteProfile {
  if (typeof data !== "object" || data === null) {
    throw new Error("Import data must be an object")
  }
  const d = data as Record<string, unknown>

  if (d.version !== 1) {
    throw new Error(`Unsupported export version: ${d.version}. Expected 1.`)
  }

  if (!d.profile || typeof d.profile !== "object") {
    throw new Error("Missing or invalid 'profile' field")
  }
  const profile = d.profile as Record<string, unknown>
  if (typeof profile.slug !== "string" || typeof profile.name !== "string") {
    throw new Error("Profile must have 'slug' and 'name' strings")
  }

  if (!Array.isArray(d.providers)) {
    throw new Error("'providers' must be an array")
  }
  if (!Array.isArray(d.experts)) {
    throw new Error("'experts' must be an array")
  }

  for (const p of d.providers) {
    if (typeof p !== "object" || p === null) throw new Error("Each provider must be an object")
    const prov = p as Record<string, unknown>
    if (typeof prov.name !== "string") throw new Error("Provider 'name' is required")
    if (typeof prov.type !== "string") throw new Error("Provider 'type' is required")
    if (!Array.isArray(prov.models)) throw new Error("Provider 'models' must be an array")
    for (const m of prov.models) {
      if (typeof (m as any).model_id !== "string") throw new Error("Model 'model_id' is required")
    }
  }

  for (const e of d.experts) {
    if (typeof e !== "object" || e === null) throw new Error("Each expert must be an object")
    const exp = e as Record<string, unknown>
    if (typeof exp.name !== "string") throw new Error("Expert 'name' is required")
    if (typeof exp.provider_name !== "string") throw new Error("Expert 'provider_name' is required")
    if (typeof exp.model_external_id !== "string") throw new Error("Expert 'model_external_id' is required")
    if (!Array.isArray(exp.keywords)) throw new Error("Expert 'keywords' must be an array")
    if (!Array.isArray(exp.overrides)) throw new Error("Expert 'overrides' must be an array")
  }

  return d as ExportedRouteProfile
}
