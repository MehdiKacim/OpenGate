import { aliasProvider, type AliasProvider, getConfig } from "../config.ts"
import type { Provider, ProviderAdapter } from "./types.ts"
import { codexProvider } from "./codex/index.ts"
import { kimiProvider } from "./kimi/index.ts"
import { createProxyProvider, type ProxyProviderConfig } from "./proxy/index.ts"

export const ANTHROPIC_STYLE_ALIASES = new Set([
  "haiku",
  "claude-haiku-4-5",
  "claude-haiku-4-5-20251001",
  "sonnet",
  "claude-sonnet-4-6",
  "opus",
  "claude-opus-4-7",
])

const LEGACY_PROVIDERS: Record<string, Provider> = {
  codex: codexProvider,
  kimi: kimiProvider,
}

// Lazily-built adapter map that includes both legacy providers (wrapped)
// and proxy providers from config
let adapterCache: Record<string, ProviderAdapter> | undefined

function wrapLegacy(p: Provider): ProviderAdapter {
  return {
    name: p.name,
    protocol: "anthropic",
    supportedModels: p.supportedModels,
    async listModels(): Promise<Array<{ id: string; provider: string }>> {
      return Array.from(p.supportedModels).map((id) => ({ id, provider: p.name }))
    },
    async* complete(request, ctx): AsyncIterable<{
      type: "delta" | "usage" | "finish"
      delta?: any
      usage?: any
      finish_reason?: string | null
    }> {
      throw new Error(`Legacy provider ${p.name} does not support OpenAI completion directly`)
    },
    handleMessages: p.handleMessages.bind(p),
    handleCountTokens: p.handleCountTokens.bind(p),
    cli: p.cli,
  }
}

function buildAdapters(): Record<string, ProviderAdapter> {
  if (adapterCache) return adapterCache
  const out: Record<string, ProviderAdapter> = {}

  for (const [name, p] of Object.entries(LEGACY_PROVIDERS)) {
    out[name] = wrapLegacy(p)
  }

  // Load proxy providers from config
  const cfg = getConfig()
  for (const [key, sec] of Object.entries(cfg.file)) {
    if (key === "codex" || key === "kimi" || key === "log" || key === "profiles") continue
    const raw = sec as Record<string, unknown> | undefined
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue
    if (raw.type !== "proxy") continue
    const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl : undefined
    const models = Array.isArray(raw.models) ? raw.models.filter((m): m is string => typeof m === "string") : []
    const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : undefined
    const allowInvalidCertificates = raw.allowInvalidCertificates === true
    if (!baseUrl || models.length === 0) continue
    const proxyConfig: ProxyProviderConfig = {
      name: key,
      baseUrl,
      models,
      apiKey,
      allowInvalidCertificates,
    }
    out[key] = createProxyProvider(proxyConfig)
  }

  adapterCache = out
  return out
}

export function getProvider(name: string): Provider {
  const p = LEGACY_PROVIDERS[name]
  if (!p) {
    throw new Error(
      `Unknown provider: ${name}. Available: ${Object.keys(LEGACY_PROVIDERS).join(", ")}`,
    )
  }
  return p
}

export function getAdapter(name: string): ProviderAdapter {
  const adapters = buildAdapters()
  const a = adapters[name]
  if (!a) {
    throw new Error(
      `Unknown provider: ${name}. Available: ${Object.keys(adapters).join(", ")}`,
    )
  }
  return a
}

export function listProviders(): string[] {
  return Object.keys(LEGACY_PROVIDERS)
}

export function listAdapters(): string[] {
  return Object.keys(buildAdapters())
}

export function allProviders(): Provider[] {
  return Object.values(LEGACY_PROVIDERS)
}

export function allAdapters(): ProviderAdapter[] {
  return Object.values(buildAdapters())
}

export function providerForModel(
  model: string,
  aliasProviderOverride?: AliasProvider,
): Provider | undefined {
  if (ANTHROPIC_STYLE_ALIASES.has(model)) return getProvider(aliasProviderOverride ?? aliasProvider())
  for (const p of allProviders()) {
    if (p.supportedModels.has(model)) return p
  }
  return undefined
}

export function adapterForModel(model: string): ProviderAdapter | undefined {
  for (const a of allAdapters()) {
    if (a.supportedModels.has(model)) return a
  }
  return undefined
}

export function allSupportedModels(): Array<{ model: string; provider: string }> {
  const out: Array<{ model: string; provider: string }> = []
  const activeAliasProvider = aliasProvider()
  for (const a of allAdapters()) {
    for (const m of a.supportedModels) out.push({ model: m, provider: a.name })
    if (a.name === activeAliasProvider) {
      for (const m of ANTHROPIC_STYLE_ALIASES) out.push({ model: m, provider: a.name })
    }
  }
  return out
}

export function invalidateAdapterCache(): void {
  adapterCache = undefined
}
