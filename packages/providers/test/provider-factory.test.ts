import { describe, expect, it } from "vitest"
import {
  ProviderAuthError,
  createProviderAdapter,
  type OAuthAuthStore,
  type ProviderRow,
} from "../src/index.js"

const staticRow: ProviderRow = {
  id: "static-id",
  name: "static",
  type: "static",
  adapter: "static",
  protocol: "openai",
  base_url: null,
  auth_type: null,
  allow_invalid_certificates: 0,
  enabled: 1,
}

const proxyRow: ProviderRow = {
  ...staticRow,
  id: "proxy-id",
  name: "local-proxy",
  type: "proxy",
  adapter: "openai",
  base_url: "http://localhost:11434/v1",
}

const authStore: OAuthAuthStore = {
  async load() {
    return { accessToken: "local-only-token" }
  },
}

const missingAuthStore: OAuthAuthStore = {
  async load() {
    return undefined
  },
}

function oauthRow(adapter: string): ProviderRow {
  return {
    ...staticRow,
    id: `${adapter}-id`,
    name: adapter,
    type: "oauth",
    adapter,
  }
}

describe("createProviderAdapter", () => {
  it("supports static providers", async () => {
    const adapter = createProviderAdapter(staticRow)

    expect(adapter.kind).toBe("static")
    await expect(adapter.listModels()).resolves.toContainEqual(
      expect.objectContaining({ id: "static-echo" }),
    )
  })

  it("supports proxy providers", () => {
    const adapter = createProviderAdapter(proxyRow)

    expect(adapter.kind).toBe("proxy")
    expect(adapter.id).toBe("proxy-id")
  })

  it.each(["kimi", "chatgpt", "gemini"])(
    "supports oauth/%s providers",
    (providerAdapter) => {
      const adapter = createProviderAdapter(oauthRow(providerAdapter), { authStore })

      expect(adapter.kind).toBe("oauth")
      expect(adapter.id).toBe(`${providerAdapter}-id`)
    },
  )

  it("returns a clear missing OAuth auth error", async () => {
    const adapter = createProviderAdapter(oauthRow("kimi"), {
      authStore: missingAuthStore,
    })

    await expect(adapter.listModels()).rejects.toThrow(ProviderAuthError)
    await expect(adapter.listModels()).rejects.toThrow(
      'OAuth credentials are missing for kimi provider "kimi"',
    )
  })

  it("reports unknown oauth adapters without rejecting oauth generically", () => {
    expect(() =>
      createProviderAdapter(oauthRow("unknown"), { authStore }),
    ).toThrow("Unsupported OAuth provider adapter")
  })
})
