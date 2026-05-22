import type { ProviderAdapter } from "@opengate/shared"
import { createStaticProvider } from "./static.js"
import { createProxyProvider } from "./proxy.js"

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
  opts: { apiKey?: string; baseUrl?: string } = {},
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

  throw new Error(`Unsupported provider type: ${row.type}`)
}
