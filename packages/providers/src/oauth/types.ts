import type { ProviderAdapter } from "@opengate/shared"

export type OAuthAdapterName = "kimi" | "chatgpt" | "gemini"

export interface OAuthProviderRef {
  id: string
  name: string
  adapter: OAuthAdapterName
}

export interface OAuthAuthRecord {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  accountId?: string
  projectId?: string
  sessionToken?: string
  baseUrl?: string
  headers?: Record<string, string>
}

export interface OAuthAuthStore {
  load(ref: OAuthProviderRef): Promise<OAuthAuthRecord | undefined>
}

export type OAuthProviderFactory = (
  ref: OAuthProviderRef,
  authStore: OAuthAuthStore,
) => ProviderAdapter

export class ProviderAuthError extends Error {
  readonly code = "OPENGATE_PROVIDER_AUTH_MISSING"

  constructor(ref: OAuthProviderRef, detail?: string) {
    const hint =
      "Add a local auth record with `pnpm cli -- auth set --provider=<id>` once an auth command is available, or populate ~/.opengate/auth.json as documented."
    super(
      `OAuth credentials are missing for ${ref.adapter} provider "${ref.name}" (${ref.id}). ${detail ?? hint}`,
    )
    this.name = "ProviderAuthError"
  }
}
