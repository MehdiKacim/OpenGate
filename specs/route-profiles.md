# OpenGate — Complete Bible / CDC / Architecture / Prompt System

Version: **2026-05-21 — Route Profiles / URL Rewrite update**

## 0. How to use this document

This document is the single source of direction for building **OpenGate** as a new clean project.

It must be given to the coding agent together with the `/archive` folder.

The archive contains historical CCP/OpenGate experiments and external PRs, including unmerged provider experiments such as Gemini. The archive is **evidence**, not doctrine.

Mandatory reading order:

1. Read this document.
2. Read `/archive/README.md`.
3. Inspect archived provider/auth code only after understanding the product boundaries.
4. Produce an extraction report before coding.
5. Build the smallest working MVP first.

If this document conflicts with archived code, **this document wins** unless a section is explicitly marked optional.

---

## 1. Executive summary

OpenGate is a local **OpenAI-compatible gateway** for personal AI resources.

It centralizes subscription-backed providers, OpenAI-compatible remote endpoints, and local OpenAI-compatible runtimes behind URL-scoped route profiles.

OpenGate exposes user-configured experts as OpenAI models, supports keyword-based prompt enrichment and optional provider/model overrides, stores runtime configuration in SQLite, and provides a local React/ReactFlow UI for configuration and routing observability.

| Decision | Final choice |
|---|---|
| Core API | OpenAI-compatible only. |
| Core endpoints | `GET /c/{profile}/v1/models`, `POST /c/{profile}/v1/chat/completions`. |
| Default endpoint | Optional default profile alias: `/v1/*` may point to a selected default route profile. |
| Config selection | URL rewrite / route profile slug. No hidden project context required. |
| Runtime config | SQLite. JSON is import/export/backups/examples only. |
| UI | Required. Graph view is required. |
| Presets | Seeds/templates only. Never constraints. |
| Route Profile | Copied, mutable configuration derived from a preset or built from scratch. |
| Experts | Runtime instances exposed as models within a route profile. Not fixed. |
| Routing | Expert -> keyword detection -> prompt enrichment -> optional override -> provider/model -> response. |
| Recursion | Forbidden. |
| Client responsibility | Context, files, repo, MCP, git, history, project orchestration. |
| OpenGate responsibility | Providers, route profiles, experts, keywords, overrides, routing, observability. |
| Low token/cost routing | Deferred post-v1 feature. Track minimal observability only if available; do not build cost logic before flow is stable. |

---

## 2. Core philosophy

- Adapt > rewrite.
- Extract > copy.
- Observable > magical.
- Explicit > hidden.
- Compatibility > reinvention.
- SQLite transactions > hand-edited runtime JSON.
- URL-scoped route profiles > hidden global active config.
- Client orchestrates; OpenGate routes.
- Projects must finish, not merely start.
- Complexity must be optional: simple defaults first, power-user overrides later.
- A product is never finished, but a version must become usable in daily work.

OpenGate is not an autonomous AI operating system. It is a configurable, observable routing layer that any OpenAI-compatible client can use.

---

## 3. Goals

OpenGate must:

- expose OpenAI-compatible endpoints usable by Zoo, Roo, Continue.dev, OpenWebUI, scripts, curl, and future clients;
- support OAuth-backed providers such as ChatGPT, Kimi, and Gemini where adapters exist;
- support proxy providers for any OpenAI-compatible endpoint: Ollama, LM Studio, OVMS, vLLM, OpenRouter, custom local servers;
- expose configured experts through `/v1/models` for each route profile so clients can call `model=builder`, `model=reviewer`, etc.;
- support presets as templates that can be copied into route profiles;
- support URL rewrite route profile selection via `/c/{profileSlug}/v1`;
- provide a local UI for providers, models, presets, route profiles, experts, logs, graph visualization, and playground testing;
- persist runtime configuration in SQLite with migrations, seeds, validation, and import/export JSON;
- generate living documentation, including React component documentation via `react-docgen`;
- remain Node LTS compatible after build, while allowing Bun for fast local development.

---

## 4. Non-goals

OpenGate is not:

- LangGraph;
- CrewAI;
- AutoGen;
- recursive multi-agent framework;
- hidden server-side orchestration of `consultant -> analyst -> builder -> reviewer`;
- inference engine;
- GPU manager;
- Anthropic-first proxy;
- LiteLLM clone for every provider in existence;
- MCP host;
- Git/GitHub/Jira/Linear manager;
- repository context manager;
- file indexer;
- conversation memory system;
- project management system;
- cloud service.

OpenGate must not manage project files, branches, tickets, MCP tools, CI queues, issue queues, or conversation history. These remain the client/tooling responsibility.

---

## 5. Source strategy: new project with `/archive`

OpenGate must be restarted as a new clean project.

The old CCP/OpenGate fork and external unmerged PR branches must be placed under `/archive`.

Recommended structure:

```text
opengate/
  archive/
    old-ccp/
    opengate-vibe-wip/
    pr-gemini-unmerged/
    notes/
  apps/
    server/
    web/
  packages/
    core/
    db/
    providers/
    routing/
    sdk/
    shared/
  docs/
  scripts/
```

Archive rules:

| Archive content | Use it for | Do not use it for |
|---|---|---|
| OAuth provider code | Auth/token/header behavior. | Copying architecture blindly. |
| Gemini PR branch | Provider behavior, model discovery, streaming quirks. | Treating unmerged code as trusted design. |
| Old OpenAI/Anthropic adapters | Edge cases and schemas. | Keeping Anthropic as core. |
| Old CLI/config | Useful defaults. | Legacy naming/design. |
| Old logs | Pain points. | Recreating noisy logs. |
| Old README/plan | Historical intent. | Product specification. |

### 5.1 Archive README requirement

Every archive subfolder must include a README:

```md
# Archive: pr-gemini-unmerged

Status: unmerged external PR
Trust: medium
Purpose: Gemini provider research
Extract:
- auth flow
- headers
- model list behavior
- streaming quirks
- error handling

Reject:
- architecture
- naming
- config format
- unrelated abstractions
```

### 5.2 Archive analysis prompt

```text
You are a senior extraction architect.

The /archive folder is historical evidence, not source of truth.

Extract useful provider behavior, auth flows, schemas, streaming quirks, and proven code.

Reject accidental complexity, legacy naming, old architecture, and dead abstractions.

For every reused idea, explain why it is still needed.

For every discarded idea, explain why it is obsolete.

Build the smallest clean MVP first.
```

---

## 6. Product model

OpenGate is built around these product objects.

| Object | Meaning | Example |
|---|---|---|
| Provider | Concrete upstream source. | `chatgpt`, `kimi`, `gemini`, `ovms-home` |
| Provider Model | Real upstream model ID. | `gpt-5.4`, `kimi-for-coding`, `gemini-pro`, `commit-writer` |
| Preset | Seed/template. Never mandatory. | `Solo Dev`, `Fullstack`, `Local First` |
| Route Profile | Copied mutable config exposed by URL. | `opengate-dev`, `work`, `home-local` |
| Project Binding | Optional `.opengate` marker pointing a repo to a route profile. | `.opengate/profile.json` |
| Expert | Runtime instance exposed as model within a route profile. | `builder`, `reviewer`, `commit-writer` |
| Keyword | Domain hint used to enrich prompt/apply override. | `frontend`, `backend`, `oauth` |
| Override | Keyword-specific provider/model substitution. | `builder + frontend -> gemini-pro` |
| Routing Event | Persisted explanation of a request route. | `builder -> frontend -> gemini` |

### 6.1 Route Profile vs Workspace vs Project

Use **Route Profile** as the canonical product term.

A route profile is a routing policy/configuration exposed through a URL namespace.

A route profile is not:

- project context;
- repository state;
- conversation history;
- file index;
- ticket system;
- branch/version manager.

A client handles context. OpenGate handles routing policy.

`Workspace` may appear in UI copy only as a friendly synonym if desired, but code and DB should prefer `route_profile`.

---

## 7. API surface

### 7.1 OpenAI-compatible route profile URLs

OpenGate must expose profile-scoped OpenAI endpoints:

```text
GET  /c/{profileSlug}/v1/models
POST /c/{profileSlug}/v1/chat/completions
```

Optional default alias:

```text
GET  /v1/models
POST /v1/chat/completions
```

The default alias may point to a configured default route profile, but it must be explicit in UI/settings.

### 7.2 Why URL rewrite is mandatory

Clients generally support OpenAI-compatible base URLs, but not all support custom headers.

Therefore config selection must happen through the base URL:

```text
http://localhost:18765/c/opengate-dev/v1
http://localhost:18765/c/work/v1
http://localhost:18765/c/home-local/v1
```

A client config is then simple:

```text
Provider: OpenAI-compatible
Base URL: http://localhost:18765/c/opengate-dev/v1
API key: anything / local dummy key
```

### 7.3 Internal/UI endpoints

| Endpoint | Required | Purpose |
|---|---|---|
| `GET /_opengate/status` | Yes | Health, default profile, server info. |
| `GET /_opengate/route-profiles` | Yes | List route profiles. |
| `GET /_opengate/route-profiles/{slug}/resolved` | Yes | Resolved graph/config. |
| `POST /_opengate/playground` | Yes | Test prompt from UI. |
| `GET /_opengate/logs` | Yes | Logs and routing events. |
| `POST /_opengate/config/import` | Yes | Import route profile JSON. |
| `GET /_opengate/config/export/{profileSlug}` | Yes | Export route profile JSON. |
| `POST /_opengate/presets/{id}/copy` | Yes | Copy preset into route profile. |
| `POST /_opengate/providers/{id}/discover-models` | Yes | Model discovery. |

### 7.4 `/v1/models` response example

```json
{
  "object": "list",
  "data": [
    { "id": "builder", "object": "model", "owned_by": "opengate" },
    { "id": "reviewer", "object": "model", "owned_by": "opengate" },
    { "id": "commit-writer", "object": "model", "owned_by": "opengate" }
  ]
}
```

### 7.5 `/v1/chat/completions` request example

```json
{
  "model": "builder",
  "messages": [
    { "role": "user", "content": "Add OAuth authentication with a React login page." }
  ],
  "stream": true
}
```

---

## 8. Runtime behavior

The OpenAI `model` name is intentionally cannibalized as an OpenGate expert name.

This makes the system portable across clients: any OpenAI-compatible client can select `model=builder` without native expert support.

| Step | Description |
|---|---|
| 1 | Client calls `/c/{profile}/v1/chat/completions` with `model=builder`. |
| 2 | OpenGate resolves `{profile}` to a route profile. |
| 3 | OpenGate resolves `builder` inside that route profile. |
| 4 | OpenGate detects keywords from user messages and expert keyword list. |
| 5 | OpenGate enriches system prompt with detected domains. |
| 6 | If keyword override exists, select override provider/model. |
| 7 | Otherwise use expert default provider/model. |
| 8 | Call provider adapter. |
| 9 | Stream/return OpenAI-compatible response. |
| 10 | Persist request and routing events for graph/logs. |

### 8.1 Mandatory no-recursion rule

Keyword routing is not sub-agent delegation.

Keywords are domains, not executable agents.

Allowed:

```text
Request -> builder -> keyword=frontend -> provider=gemini -> response
```

Forbidden:

```text
Request -> builder -> frontend expert -> builder -> backend expert -> ...
```

No loops. No recursive expert routing. No hidden server orchestration.

---

## 9. Presets and route profiles

Experts are not hardcoded.

OpenGate ships presets as seeds. Users copy presets into route profiles or create route profiles from scratch.

| Preset | Goal | Seeded experts / routing |
|---|---|---|
| Flash | Fast small changes. | `builder`, `validator` |
| Solo Dev | Balanced personal development. | `consultant`, `analyst`, `builder`, `reviewer`, `validator` |
| Startup | Ship quickly with product discipline. | `consultant`, `product-owner`, `planner`, `builder`, `reviewer`, `validator`, `devops` |
| Enterprise | Strict process/delivery. | `consultant`, `analyst`, `product-owner`, `planner`, `builder`, `reviewer`, `validator`, `devops`, optional `auditor` |
| Fullstack | Web/fullstack development. | `builder` with `backend/frontend/oauth/security/database/api` keywords |
| AI Engineer | AI/provider/routing projects. | `consultant`, `analyst`, `builder`, `reviewer`, `validator` with `ai/routing/provider/prompt` keywords |
| Local First | Maximize local models. | local `builder`, `commit-writer`, optional remote reviewer |

Rules:

- Seed presets only when DB is empty or user asks to reseed.
- Never overwrite user route profiles during upgrade.
- A route profile can be created, copied, cloned, exported, imported, renamed, compared, reset, and deleted.
- A user can delete all seeded experts and build a custom route profile.
- Preset = template.
- Route profile = copied, mutable runtime config.
- URL selects route profile.

---

## 10. Standard role prompt templates

These are templates only. They are not fixed mandatory experts.

### 10.1 Consultant

Challenge requests before analysis.

Responsibilities:

- search for existing code;
- identify reusable patterns;
- avoid rewriting;
- estimate complexity;
- identify risks;
- recommend adapt/reuse/build.

Forbidden:

- coding;
- implementation;
- silent architecture redesign.

Output:

```md
# Consultant Report
Objective:
Existing/reusable:
Risks:
Complexity:
Recommendation:
```

### 10.2 Analyst

Turn request + consultant report into a specification.

Output:

```md
# Specification
Context:
Goal:
Constraints:
Assumptions:
Architecture impact:
Success criteria:
Open questions:
```

### 10.3 Product Owner

Own value, scope, MVP, prioritization, roadmap, milestones, and refusal of low-value complexity.

Output:

```md
# Product Decision
Value:
MVP:
Must:
Should:
Could:
Deferred:
Rejected:
```

### 10.4 Planner

Convert specification and PO priorities into executable work.

Output:

```md
# Plan
Tasks:
Dependencies:
Acceptance criteria:
Definition of Done:
Suggested branches/issues:
```

### 10.5 Builder

Implement clean working code. Full-stack capable.

Rules:

- respect scope;
- follow existing patterns;
- do not redesign silently;
- if ambiguous, return to analyst.

### 10.6 Reviewer

Assume implementation is wrong. Find bugs, regressions, overengineering, security issues, maintainability risks, and missing edge cases.

### 10.7 Validator

Verify reality: typecheck, tests, build, smoke tests, acceptance criteria, compatibility.

Output:

```text
PASS
```

or:

```text
FAIL:
- exact failure
- required fix
```

### 10.8 DevOps

Infer CI/CD, build, packaging, artifacts, releases, workflows, deployment readiness.

This role is a prompt preset. It does not mean OpenGate manages CI/CD itself.

### 10.9 Commit Writer

Generate concise conventional commits from diffs.

---

## 11. Provider architecture

All providers are adapters behind a small interface.

The core gateway must not contain provider-specific logic except adapter registration.

```ts
export interface ProviderAdapter {
  id: string;
  displayName: string;
  kind: "oauth" | "proxy" | "static";
  protocol: "openai";
  listModels(): Promise<ProviderModel[]>;
  chatCompletions(req: OpenAIChatCompletionRequest, ctx: RequestContext): Promise<Response>;
  health?(): Promise<ProviderHealth>;
}

export interface ProviderModel {
  id: string;
  displayName?: string;
  contextWindow?: number;
  capabilities?: string[];
}
```

| Provider type | Examples | Notes |
|---|---|---|
| OAuth | ChatGPT, Kimi, Gemini | Uses OAuth token storage and adapter. |
| Proxy | Ollama, LM Studio, OVMS, vLLM, OpenRouter | Calls OpenAI-compatible upstream `baseUrl`. |
| Static | Mock/test provider | Used for tests/offline dev. |

### 11.1 Model discovery

The UI must pre-list provider models.

Users should select discovered models rather than typing IDs manually.

Manual model entry is allowed only for providers that cannot list models.

---

## 12. SQLite database architecture

SQLite is the runtime source of truth.

Use migrations. Use transactions. Use foreign keys. JSON is import/export only.

### 12.1 Query layer and migrations

Use:

- Kysely as SQL query builder;
- `better-sqlite3` as SQLite driver;
- explicit migrations;
- Zod for import/export validation.

Avoid ORM magic and runtime-specific SQLite APIs.

Migration requirements:

- versioned and deterministic;
- foreign keys enabled;
- seeds idempotent;
- preset seeds never overwrite route profiles;
- imports write transactionally;
- validation can run without HTTP server.

### 12.2 Tables

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  seed_version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE route_profiles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  source_preset_id TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(source_preset_id) REFERENCES presets(id)
);

CREATE TABLE project_bindings (
  id TEXT PRIMARY KEY,
  route_profile_id TEXT NOT NULL,
  project_root TEXT NOT NULL,
  project_name TEXT NOT NULL,
  marker_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_root),
  FOREIGN KEY(route_profile_id) REFERENCES route_profiles(id) ON DELETE CASCADE
);

CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  route_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('oauth','proxy','static')),
  adapter TEXT,
  protocol TEXT NOT NULL DEFAULT 'openai',
  base_url TEXT,
  auth_type TEXT,
  allow_invalid_certificates INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_profile_id, name),
  FOREIGN KEY(route_profile_id) REFERENCES route_profiles(id) ON DELETE CASCADE
);

CREATE TABLE provider_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT,
  context_window INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  discovered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, model_id),
  FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE TABLE experts (
  id TEXT PRIMARY KEY,
  route_profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  temperature REAL,
  max_tokens INTEGER,
  expose_as_model INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(route_profile_id, name),
  FOREIGN KEY(route_profile_id) REFERENCES route_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY(provider_id) REFERENCES providers(id),
  FOREIGN KEY(model_id) REFERENCES provider_models(id)
);

CREATE TABLE expert_keywords (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  UNIQUE(expert_id, keyword),
  FOREIGN KEY(expert_id) REFERENCES experts(id) ON DELETE CASCADE
);

CREATE TABLE keyword_overrides (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(expert_id) REFERENCES experts(id) ON DELETE CASCADE,
  FOREIGN KEY(provider_id) REFERENCES providers(id),
  FOREIGN KEY(model_id) REFERENCES provider_models(id)
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  route_profile_id TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  final_provider_id TEXT,
  final_model_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  latency_ms INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  error TEXT,
  FOREIGN KEY(route_profile_id) REFERENCES route_profiles(id)
);

CREATE TABLE routing_events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  expert_name TEXT NOT NULL,
  detected_keywords_json TEXT NOT NULL,
  selected_provider_id TEXT,
  selected_model_id TEXT,
  override_keyword TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
);

CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE SET NULL
);
```

### 12.3 Low consumption fields

The token columns in `requests` are allowed as passive observability if provider responses expose usage.

OpenGate must not implement cost-aware model selection in v1.

---

## 13. JSON import/export examples

JSON config is not runtime store.

It is for import/export, sharing, backup, docs.

### 13.1 Route profile export example

```json
{
  "$schema": "./opengate.route-profile.schema.json",
  "routeProfile": {
    "slug": "opengate-dev",
    "name": "OpenGate Development",
    "sourcePreset": "fullstack"
  },
  "providers": {
    "chatgpt": {
      "type": "oauth",
      "adapter": "chatgpt",
      "models": ["gpt-5.4", "gpt-5.4-mini-fast"]
    },
    "kimi": {
      "type": "oauth",
      "adapter": "kimi",
      "models": ["kimi-for-coding"]
    },
    "gemini": {
      "type": "oauth",
      "adapter": "gemini",
      "models": ["gemini-pro"]
    },
    "local": {
      "type": "proxy",
      "baseUrl": "http://localhost:11434/v1",
      "models": ["commit-writer"],
      "allowInvalidCertificates": false
    }
  },
  "experts": {
    "consultant": {
      "provider": "chatgpt",
      "model": "gpt-5.4",
      "systemPrompt": "Challenge the request before implementation. Prefer adaptation over rewrite."
    },
    "builder": {
      "provider": "kimi",
      "model": "kimi-for-coding",
      "systemPrompt": "Implement clean working code. Stay in scope. Full-stack capable.",
      "keywords": ["backend", "frontend", "oauth", "security", "database", "api", "typescript"],
      "keywordOverrides": {
        "frontend": { "provider": "gemini", "model": "gemini-pro" }
      }
    },
    "reviewer": {
      "provider": "chatgpt",
      "model": "gpt-5.4",
      "systemPrompt": "Assume the implementation is wrong. Find bugs, risks, regressions and overengineering."
    },
    "commit-writer": {
      "provider": "local",
      "model": "commit-writer",
      "systemPrompt": "Generate concise conventional commits from diffs."
    }
  }
}
```

### 13.2 `.opengate/profile.json` example

Created by `opengate init` in a project root.

```json
{
  "schemaVersion": 1,
  "routeProfile": "opengate-dev",
  "baseUrl": "http://localhost:18765/c/opengate-dev/v1",
  "projectName": "OpenGate",
  "createdAt": "2026-05-21T00:00:00.000Z"
}
```

This file is a marker and convenience reference.

It must not contain secrets.

The client must still be configured to use the displayed Base URL.

---

## 14. Validation rules

Validation must fail fast.

Rules:

- route profile slug must be unique;
- route profile slug must be URL-safe;
- every expert must reference an existing provider in the same route profile;
- every expert model must exist in provider models for that provider;
- every keyword override must reference an existing keyword or be explicitly marked free-form;
- every override provider/model must exist and be enabled;
- only proxy providers may set `allow_invalid_certificates`;
- no unknown provider type;
- no route profile can expose two enabled experts with the same model name;
- startup must fail on invalid default route profile;
- import validates fully before transaction write;
- export must be deterministic and human-readable;
- project binding cannot point to a missing route profile;
- `.opengate/profile.json` must match a DB route profile or show repair instructions.

---

## 15. User interface requirements

The UI is not optional.

OpenGate configuration becomes too complex for CLI-only management.

| Page | Purpose |
|---|---|
| Overview | Server status, default route profile, provider health, exposed models. |
| Providers | Add provider, OAuth login, proxy baseUrl, TLS flag, discover models. |
| Models | Enable/disable discovered models. |
| Route Profiles | Create, clone, import, export, activate default, compare. |
| Presets | Preview and copy preset into a route profile. |
| Experts | Create/edit expert, choose provider/model from dropdown, edit prompt, manage keywords and overrides. |
| Graph | ReactFlow routing graph showing request -> expert -> keyword -> provider -> model -> response. |
| Logs | Filter requests, routing events, provider errors, TLS errors, token/latency. |
| Playground | Choose route profile, expert, prompt, inspect route/response. |
| Docs | Generated docs index from react-docgen, API docs, DB docs, ADRs. |

---

## 16. ReactFlow graph requirements

The graph is first-class observability.

Example:

```text
[Request]
   |
   v
[Route Profile: opengate-dev]
   |
   v
[Expert: builder]
   |
   v
[Keywords: frontend, oauth, security]
   |
   v
[Override: frontend]
   |
   v
[Provider: gemini]
   |
   v
[Model: gemini-pro]
   |
   v
[Response]
```

Nodes:

- Request
- Route Profile
- Expert
- Keyword
- Override
- Provider
- Model
- Response
- Error

Edges:

- requested
- resolved
- detected
- overridden
- sent_to
- returned

Node badges:

- latency
- tokens if available
- status
- enabled/disabled
- error

Graph modes:

- last request graph;
- route profile design graph;
- provider health graph.

---

## 17. Tech stack and project layout

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript | Shared types front/back. |
| Runtime | Bun for dev, Node LTS compatible after build | Fast local dev without Bun lock-in. |
| HTTP | Hono | Small, Web API based. |
| Validation | Zod | Runtime schemas + inferred TS. |
| Database | SQLite + Kysely + better-sqlite3 | SQL-first, typed queries, Node/Bun compatible. |
| Logging | Pino | Structured logs. |
| Frontend | React + Vite | Fast local UI. |
| Graph | ReactFlow | Routing graph. |
| Data fetching | TanStack Query | Server state. |
| Docs | react-docgen + TypeDoc + OpenAPI | Living docs. |
| Tests | Vitest | Simple TS tests. |

Project layout:

```text
opengate/
  archive/
  apps/
    server/
    web/
  packages/
    core/
    db/
    providers/
    routing/
    sdk/
    shared/
  docs/
    architecture/
    api/
    components/
    database/
    routing/
    presets/
    adr/
  scripts/
  README.md
```

### 17.1 Runtime compatibility rule

OpenGate must remain runtime-portable.

Rules:

- no `Bun.*` in core runtime except isolated runtime adapter;
- no `bun:sqlite`;
- use `better-sqlite3`;
- HTTP code uses standard Web APIs/Hono;
- TLS bypass is per provider only;
- dev can use `bun run dev`;
- production supports `node dist/index.js`.

Example scripts:

```json
{
  "scripts": {
    "dev": "bun --watch apps/server/src/index.ts",
    "build": "tsc -b",
    "start": "node apps/server/dist/index.js",
    "validate": "node apps/server/dist/cli.js validate",
    "docs": "pnpm docs:api && pnpm docs:components && pnpm docs:typedoc && pnpm docs:db"
  }
}
```

---

## 18. Documentation requirements

Documentation is mandatory.

- React component docs using `react-docgen`.
- TypeScript docs using TypeDoc.
- OpenAPI spec for HTTP endpoints.
- DB docs generated from migrations/schema.
- ADRs for major choices.
- Routing docs with graph examples.
- Preset/route profile docs.
- Archive extraction docs.

Docs structure:

```text
docs/
  architecture/
    overview.md
    runtime-flow.md
    archive-extraction.md
  api/
    openapi.yaml
    endpoints.md
  components/
    react-docgen.json
    index.md
  database/
    schema.md
    migrations.md
  routing/
    keywords.md
    overrides.md
    graph.md
    route-profiles.md
  presets/
    flash.md
    solodev.md
    startup.md
    enterprise.md
    fullstack.md
    ai-engineer.md
    local-first.md
  adr/
    0001-openai-compatible-only.md
    0002-sqlite-runtime-config.md
    0003-presets-not-fixed-experts.md
    0004-reactflow-routing-graph.md
    0005-url-scoped-route-profiles.md
    0006-node-compatible-bun-development.md
    0007-low-token-routing-deferred.md
```

Required docs scripts:

```json
{
  "docs": "pnpm docs:api && pnpm docs:components && pnpm docs:typedoc && pnpm docs:db",
  "docs:components": "react-docgen apps/web/src --out docs/components/react-docgen.json",
  "docs:typedoc": "typedoc packages --out docs/api/typedoc",
  "docs:api": "openapi-generator-or-script",
  "docs:db": "schema-doc-generator-or-custom-script"
}
```

---

## 19. CLI requirements

The UI is primary.

The CLI is minimal and exists for recovery, automation, and project route-profile binding.

| Command | Purpose |
|---|---|
| `opengate serve` | Start server and UI. |
| `opengate init` | Bind current project root to a route profile and create `.opengate/profile.json`. |
| `opengate status` | Show server URL, default profile, current project binding if present. |
| `opengate validate` | Validate DB, route profiles, providers, experts. |
| `opengate export --profile X` | Export route profile JSON. |
| `opengate import file.json` | Validate and import route profile JSON transactionally. |
| `opengate seed` | Seed default presets if missing. |
| `opengate docs` | Generate documentation. |

### 19.1 `opengate init`

`opengate init` run at a project root must:

1. detect current directory;
2. ask user to select existing route profile or copy preset into new route profile;
3. register/update `project_bindings` in SQLite;
4. create `.opengate/profile.json`;
5. print base URL to configure in the client;
6. never store secrets locally.

Important: `.opengate/profile.json` does not magically make clients choose the route profile. The client must use the generated base URL:

```text
http://localhost:18765/c/{profileSlug}/v1
```

CLI must not manage:

- git;
- issues;
- PRs;
- MCP;
- files;
- context;
- branches;
- CI queues.

---

## 20. Global system prompt for the coding agent

```text
You are building OpenGate as a new clean project.

You must read the OpenGate Bible and the /archive folder.

The archive is historical evidence, not source of truth.

Mandatory principles:
- OpenAI-compatible core only.
- URL-scoped route profiles select configuration.
- SQLite runtime config.
- JSON import/export only.
- Presets are seeds, not fixed experts.
- Route profiles are copied, editable configurations exposed by /c/{slug}/v1.
- Experts are runtime instances exposed as models.
- Keyword routing is prompt enrichment plus optional provider/model override.
- No recursion.
- No hidden server-side orchestration.
- Client orchestrates; OpenGate routes.
- Client owns context, MCP, files, git, history, tickets.
- OpenGate owns providers, experts, route profiles, routing, observability.
- ReactFlow graph UI is required.
- react-docgen documentation is required.
- Build smallest working MVP first.
- Low token/cost routing is deferred post-v1. Do not implement policy logic before the core flow works.

Before coding, output:
1. Archive findings.
2. Clean architecture plan.
3. Database schema.
4. Provider contracts.
5. URL route profile design.
6. UI route map.
7. Implementation order.
8. Tests and acceptance criteria.

During coding:
- Keep changes incremental.
- Prefer explicit schemas and validation.
- Fail fast on config errors.
- Write docs as code is created.
- Do not invent features outside this document unless explicitly requested.
```

---

## 21. MVP roadmap and Definition of Done

| Phase | Scope | Done when |
|---|---|---|
| MVP 0 | Server + SQLite + one proxy provider + one route profile | `curl /c/default/v1/models` and chat completions work. |
| MVP 1 | Providers + model discovery | UI can add provider, list models, save config. |
| MVP 2 | Presets + route profile copy | User can copy preset into route profile. |
| MVP 3 | Experts exposed as models | `/c/{profile}/v1/models` returns experts from that profile. |
| MVP 4 | `opengate init` + URL profile binding | Project gets `.opengate/profile.json` and base URL instructions. |
| MVP 5 | Keyword routing + overrides | `builder` frontend request routes to configured override. |
| MVP 6 | Graph UI | Last request route visible as ReactFlow graph. |
| MVP 7 | Docs | react-docgen, API docs, DB docs generated. |

Do not implement low-token/cost optimization before these phases are stable and used in real daily work.

---

## 22. Acceptance tests

```text
1. Start OpenGate.
2. Seed presets.
3. Create route profile from Fullstack preset with slug opengate-dev.
4. Add provider kimi with model kimi-for-coding.
5. Add provider gemini with model gemini-pro.
6. Configure builder default to kimi.
7. Configure builder keyword override frontend -> gemini-pro.
8. GET /c/opengate-dev/v1/models includes builder.
9. POST /c/opengate-dev/v1/chat/completions model=builder content="Create React login page".
10. Routing event shows profile=opengate-dev, keyword=frontend, provider=gemini, model=gemini-pro.
11. Graph UI shows Request -> Route Profile -> builder -> frontend -> gemini -> gemini-pro -> Response.
12. Run opengate init in a project root.
13. .opengate/profile.json is created and references opengate-dev.
14. Client configured with base URL /c/opengate-dev/v1 routes identically.
15. Export route profile.
16. Import route profile into a new DB.
17. Same request routes the same way.
18. Generate docs successfully.
```

---

## 23. Deferred post-v1: low token / cost-aware routing

This is important but explicitly deferred.

Reason: the complete routing flow must work before adding cost/metric policy logic.

Post-v1 goal:

- measure token usage;
- measure latency;
- compare providers/models;
- detect overuse of expensive models;
- allow policies such as `low-consumption`, `balanced`, `quality`;
- optionally route tiny tasks to cheaper/faster models;
- optionally fallback on quota errors.

Out of v1 scope:

- automatic cost optimization;
- budget enforcement;
- quota forecasting;
- provider load balancing;
- smart fallback chains;
- model quality scoring.

V1 may store passive usage fields if provider returns them, but must not make routing decisions based on them.

---

## 24. Responsibility boundaries

Client responsibilities:

- context;
- files;
- repository;
- branches;
- MCP;
- tools;
- conversation history;
- project memory;
- workflow/orchestration.

OpenGate responsibilities:

- OpenAI-compatible facade;
- route profile URL resolution;
- providers;
- model discovery;
- presets;
- experts;
- keywords;
- provider/model overrides;
- graph/log observability;
- import/export;
- documentation.

External tools:

- CI/CD;
- GitHub/Git;
- Jira/Linear/issues;
- deployments;
- artifacts;
- queues.

If a feature belongs clearly to the client or external tools, it must not enter OpenGate core.
