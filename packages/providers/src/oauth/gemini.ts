import type {
  OpenAIChatCompletionRequest,
  ProviderAdapter,
  ProviderModel,
  RequestContext,
} from "@opengate/shared"
import type { OAuthAuthStore, OAuthProviderRef } from "./types.js"
import { ProviderAuthError } from "./types.js"

const MODELS: ProviderModel[] = [
  { id: "gemini-3-pro-preview", displayName: "Gemini 3 Pro Preview" },
  { id: "gemini-2.5-pro", displayName: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
]

export function createGeminiProvider(
  ref: OAuthProviderRef,
  authStore: OAuthAuthStore,
): ProviderAdapter {
  return {
    id: ref.id,
    displayName: ref.name,
    kind: "oauth",
    protocol: "openai",

    async listModels() {
      await requireAuth(ref, authStore)
      return MODELS
    },

    async chatCompletions(
      _req: OpenAIChatCompletionRequest,
      _ctx: RequestContext,
    ) {
      await requireAuth(ref, authStore)
      return notIntegratedResponse(
        "Gemini OAuth credentials are present, but the recovered Code Assist setup and translation flow has not been integrated into the OpenAI chat-completions adapter yet.",
      )
    },
  }
}

async function requireAuth(ref: OAuthProviderRef, authStore: OAuthAuthStore) {
  const auth = await authStore.load(ref)
  if (!auth?.accessToken) {
    throw new ProviderAuthError(
      ref,
      "Restore a Gemini access token in ~/.opengate/auth.json; browser OAuth recovery is still isolated in the archive.",
    )
  }
  return auth
}

function notIntegratedResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: { type: "provider_not_configured", message } }),
    { status: 501, headers: { "content-type": "application/json" } },
  )
}
