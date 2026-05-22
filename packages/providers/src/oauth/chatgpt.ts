import type {
  OpenAIChatCompletionRequest,
  ProviderAdapter,
  ProviderModel,
  RequestContext,
} from "@opengate/shared"
import type { OAuthAuthStore, OAuthProviderRef } from "./types.js"
import { ProviderAuthError } from "./types.js"

const MODELS: ProviderModel[] = [
  { id: "gpt-5", displayName: "GPT-5" },
  { id: "gpt-5-codex", displayName: "GPT-5 Codex" },
]

export function createChatGptProvider(
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
        "ChatGPT/Codex OAuth credentials are present, but the recovered Codex Responses translation layer has not been integrated into the OpenAI chat-completions adapter yet.",
      )
    },
  }
}

async function requireAuth(ref: OAuthProviderRef, authStore: OAuthAuthStore) {
  const auth = await authStore.load(ref)
  if (!auth?.accessToken) {
    throw new ProviderAuthError(
      ref,
      "Restore the ChatGPT/Codex local auth record in ~/.opengate/auth.json; route profile exports never carry it.",
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
