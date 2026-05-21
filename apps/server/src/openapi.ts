export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "OpenGate API",
    version: "0.1.0",
    description: "Local AI gateway with OpenAI-compatible endpoints and route profiles",
  },
  servers: [{ url: "http://localhost:18765" }],
  paths: {
    "/_opengate/status": {
      get: {
        tags: ["Internal"],
        summary: "Server status",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    version: { type: "string" },
                    defaultProfile: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/_opengate/route-profiles": {
      get: {
        tags: ["Internal"],
        summary: "List route profiles",
        responses: {
          "200": {
            description: "List of route profiles",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/RouteProfile" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/_opengate/route-profiles/{slug}/resolved": {
      get: {
        tags: ["Internal"],
        summary: "Get resolved route profile config",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Resolved profile with experts, keywords, overrides" },
          "404": { description: "Route profile not found" },
        },
      },
    },
    "/_opengate/route-profiles/{slug}/providers": {
      get: {
        tags: ["Internal"],
        summary: "List providers and models for a route profile",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Providers and models" },
          "404": { description: "Route profile not found" },
        },
      },
    },
    "/_opengate/presets": {
      get: {
        tags: ["Internal"],
        summary: "List presets",
        responses: {
          "200": { description: "List of presets" },
        },
      },
    },
    "/_opengate/presets/{id}/copy": {
      post: {
        tags: ["Internal"],
        summary: "Copy a preset into a route profile",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  slug: { type: "string" },
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Copied successfully" },
          "404": { description: "Preset not found" },
          "409": { description: "Slug already exists" },
        },
      },
    },
    "/_opengate/logs": {
      get: {
        tags: ["Internal"],
        summary: "List recent routing logs",
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          "200": { description: "Routing events" },
        },
      },
    },
    "/_opengate/playground": {
      post: {
        tags: ["Internal"],
        summary: "Test a prompt through the gateway",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  profileSlug: { type: "string" },
                  model: { type: "string" },
                  messages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        role: { type: "string" },
                        content: { type: "string" },
                      },
                    },
                  },
                },
                required: ["profileSlug", "model", "messages"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Chat completion response" },
          "400": { description: "Invalid request" },
        },
      },
    },
    "/c/{profileSlug}/v1/models": {
      get: {
        tags: ["OpenAI-compatible"],
        summary: "List models (experts) for a route profile",
        parameters: [
          { name: "profileSlug", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "OpenAI model list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    object: { type: "string" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Model" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Route profile not found" },
        },
      },
    },
    "/c/{profileSlug}/v1/chat/completions": {
      post: {
        tags: ["OpenAI-compatible"],
        summary: "Chat completions",
        parameters: [
          { name: "profileSlug", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  model: { type: "string" },
                  messages: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        role: { type: "string" },
                        content: {},
                      },
                    },
                  },
                  stream: { type: "boolean" },
                  temperature: { type: "number" },
                  max_tokens: { type: "integer" },
                },
                required: ["model", "messages"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Chat completion or stream" },
          "400": { description: "Invalid request" },
          "404": { description: "Route profile or model not found" },
        },
      },
    },
  },
  components: {
    schemas: {
      RouteProfile: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          is_default: { type: "integer" },
          preset_name: { type: "string", nullable: true },
        },
      },
      Model: {
        type: "object",
        properties: {
          id: { type: "string" },
          object: { type: "string" },
          created: { type: "integer" },
          owned_by: { type: "string" },
        },
      },
    },
  },
}
