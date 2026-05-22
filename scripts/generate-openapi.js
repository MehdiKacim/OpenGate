import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const spec = {
  openapi: "3.1.0",
  info: {
    title: "OpenGate API",
    version: "0.1.0",
    description: "OpenAI-compatible routing proxy with profile-scoped endpoints",
  },
  servers: [
    { url: "/c/{profileSlug}/v1", variables: { profileSlug: { default: "default" } } },
  ],
  paths: {
    "/models": {
      get: {
        summary: "List models exposed by a route profile",
        operationId: "listModels",
        parameters: [{ $ref: "#/components/parameters/ProfileSlug" }],
        responses: {
          "200": { description: "List of models", content: { "application/json": { schema: { type: "object" } } } },
          "404": { description: "Profile not found" },
        },
      },
    },
    "/chat/completions": {
      post: {
        summary: "Chat completions (OpenAI-compatible)",
        operationId: "chatCompletions",
        parameters: [{ $ref: "#/components/parameters/ProfileSlug" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  messages: { type: "array" },
                  stream: { type: "boolean" },
                  temperature: { type: "number" },
                  max_tokens: { type: "number" },
                },
                required: ["model", "messages"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Chat completion response or SSE stream" },
          "400": { description: "Bad request" },
          "404": { description: "Profile or model not found" },
          "500": { description: "Provider error" },
        },
      },
    },
    "/_opengate/status": {
      get: {
        summary: "Server status",
        operationId: "getStatus",
        responses: {
          "200": { description: "Server is up" },
        },
      },
    },
    "/_opengate/route-profiles": {
      get: {
        summary: "List route profiles",
        operationId: "listRouteProfiles",
        responses: {
          "200": { description: "Profiles list", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/_opengate/route-profiles/{slug}/resolved": {
      get: {
        summary: "Resolved route profile config",
        operationId: "getResolvedProfile",
        parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Resolved profile" },
          "404": { description: "Profile not found" },
        },
      },
    },
  },
  components: {
    parameters: {
      ProfileSlug: {
        name: "profileSlug",
        in: "path",
        required: true,
        schema: { type: "string" },
      },
    },
  },
}

const outDir = join(process.cwd(), "docs", "api")
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, "openapi.json"), JSON.stringify(spec, null, 2))
console.log("Generated docs/api/openapi.json")
