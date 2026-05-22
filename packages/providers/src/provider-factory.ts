import type { ProviderAdapter } from "@opengate/shared"
import { createStaticProvider } from "./static.js"
import { createProxyProvider } from "./proxy.js"
import { createChatGptProvider } from "./oauth/chatgpt.js"
import { createGeminiProvider } from "./oauth/gemini.js"
import { createKimiProvider } from "./oauth/kimi.js"
import { defaultOAuthAuthStore } from "./oauth/auth-store.js"
import type { OAuthAdapterName, OAuthAuthStore } from "./oauth/types.js"

export interface ProviderRow {
  id: string
  name: string
  type: "oauth" | "proxy" | "static"
  adapter: string | null
  protocol: string
  base_url: string | null
  auth_type: string | null
  allow_invalid_certificates: number
  enabled: number
}

export function createProviderAdapter(
  row: ProviderRow,
  opts: { apiKey?: string; baseUrl?: string; authStore?: OAuthAuthStore } = {},
): ProviderAdapter {
  if (row.type === "static") {
    return createStaticProvider()
  }

  if (row.type === "proxy") {
    const baseUrl = opts.baseUrl ?? row.base_url
    if (!baseUrl) {
      throw new Error(`Proxy provider "${row.name}" is missing a base_url`)
    }
    return createProxyProvider({
      id: row.id,
      displayName: row.name,
      baseUrl,
      apiKey: opts.apiKey,
      allowInvalidCertificates: row.allow_invalid_certificates === 1,
    })
  }

  if (row.type === "oauth") {
    const adapter = row.adapter?.toLowerCase()
    const ref = {
      id: row.id,
      name: row.name,
      adapter: adapter as OAuthAdapterName,
    }
    const authStore = opts.authStore ?? defaultOAuthAuthStore

    if (adapter === "kimi") return createKimiProvider(ref, authStore)
    if (adapter === "chatgpt" || adapter === "codex") {
      return createChatGptProvider({ ...ref, adapter: "chatgpt" }, authStore)
    }
    if (adapter === "gemini") return createGeminiProvider(ref, authStore)

    throw new Error(
      `Unsupported OAuth provider adapter: ${row.adapter ?? "(missing)"}. Expected kimi, chatgpt, or gemini.`,
    )
  }

  throw new Error(`Unsupported provider type: ${row.type}`)
}
