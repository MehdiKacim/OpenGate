import { arch, hostname, platform, release } from "node:os"
import type {
  OAuthAuthRecord,
  OAuthAuthStore,
  OAuthProviderRef,
} from "./types.js"
import { ProviderAuthError } from "./types.js"
import type {
  OpenAIChatCompletionRequest,
  ProviderAdapter,
  ProviderModel,
} from "@opengate/shared"

const KIMI_BASE_URL = "https://api.kimi.com/coding/v1"
const KIMI_CLI_VERSION = "1.37.0"
const MODELS: ProviderModel[] = [
  { id: "kimi-for-coding", displayName: "Kimi for Coding" },
  { id: "kimi-k2.6", displayName: "Kimi K2.6" },
  { id: "k2.6", displayName: "Kimi K2.6" },
]

export function createKimiProvider(
  ref: OAuthProviderRef,
  authStore: OAuthAuthStore,
): ProviderAdapter {
  return {
    id: ref.id,
    displayName: ref.name,
    kind: "oauth",
    protocol: "openai",

    async listModels() {
      await loadKimiAuth(ref, authStore)
      return MODELS
    },

    async chatCompletions(req: OpenAIChatCompletionRequest) {
      const auth = await loadKimiAuth(ref, authStore)
      const response = await fetch(`${trimTrailingSlash(auth.baseUrl ?? KIMI_BASE_URL)}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: req.stream ? "text/event-stream" : "application/json",
          authorization: `Bearer ${auth.accessToken}`,
          ...kimiHeaders(auth),
        },
        body: JSON.stringify(req),
      })

      if (response.status === 401 || response.status === 403) {
        return oauthErrorResponse(
          response.status,
          `Kimi rejected the stored OAuth credentials for provider "${ref.name}". Refresh or restore the local auth record.`,
        )
      }
      return response
    },
  }
}

async function loadKimiAuth(
  ref: OAuthProviderRef,
  authStore: OAuthAuthStore,
): Promise<OAuthAuthRecord & { accessToken: string }> {
  const auth = await authStore.load(ref)
  if (!auth?.accessToken) {
    throw new ProviderAuthError(
      ref,
      "Store a Kimi access token outside route profiles in ~/.opengate/auth.json; refresh/login recovery is not exposed by the new CLI yet.",
    )
  }
  return { ...auth, accessToken: auth.accessToken }
}

function kimiHeaders(auth: OAuthAuthRecord): Record<string, string> {
  return {
    "x-msh-platform": "kimi_cli",
    "x-msh-version": KIMI_CLI_VERSION,
    "x-msh-device-name": asciiHeader(hostname()),
    "x-msh-device-model": asciiHeader(`${platform()} ${release()} ${arch()}`),
    "x-msh-os-version": asciiHeader(release()),
    "user-agent": `KimiCLI/${KIMI_CLI_VERSION}`,
    ...auth.headers,
  }
}

function asciiHeader(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "").trim() || "unknown"
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "")
}

function oauthErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { type: "authentication_error", message } }),
    { status, headers: { "content-type": "application/json" } },
  )
}
