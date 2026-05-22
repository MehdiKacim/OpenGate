# OpenGate

OpenAI-compatible routing proxy with profile-scoped endpoints.

## Quick start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start server with default profile
pnpm cli serve

# Or start the full stack (server + web UI)
pnpm dev
```

## Local development

```bash
pnpm install
pnpm dev
```

- UI: http://localhost:5173
- API: http://localhost:18765/c/default/v1

## CLI development

```bash
pnpm cli -- status
pnpm cli -- init
pnpm cli -- export --profile default
```

Available commands:

```bash
node apps/server/dist/cli.js serve              # Start server
node apps/server/dist/cli.js seed               # Seed default presets
node apps/server/dist/cli.js validate           # Validate DB and config
node apps/server/dist/cli.js status             # Show server and binding status
node apps/server/dist/cli.js export --profile=<slug> > file.json
node apps/server/dist/cli.js import <file.json> [--slug=new-slug] [--overwrite]
node apps/server/dist/cli.js init               # Bind current project to a route profile
```

## Production-like local run

```bash
pnpm build
pnpm start
```

- UI: http://localhost:18765
- API: http://localhost:18765/c/default/v1

## Windows artifact

Download `opengate-windows-x64.zip` from the [GitHub Releases](https://github.com/mkacim/opengate/releases), extract, and run:

```powershell
.\opengate.exe
```

Or, if using the fallback zip with a launcher:

```powershell
.\opengate.bat
```

CLI flags:

```powershell
.\opengate.exe --no-open
.\opengate.exe --port 18765
.\opengate.exe --db .\opengate.sqlite
```

## Project structure

- `apps/server` — Hono API server with OpenAI-compatible endpoints
- `apps/web` — React + Vite admin dashboard with ReactFlow graph
- `packages/db` — SQLite + Kysely schema and migrations
- `packages/core` — Domain services (import/export, routing resolution)
- `packages/providers` — Provider adapters (static, proxy, isolated OAuth adapter wiring)
- `packages/routing` — Routing resolution engine
- `packages/shared` — Shared types and schemas
- `packages/sdk` — Client SDK placeholder

## Specs & Architecture

See [`specs/`](specs/) for architecture documents and ADRs.

## Provider auth status

`static` and OpenAI-compatible `proxy` providers are usable now. OAuth providers
are wired through isolated adapters for `kimi`, `chatgpt`, and `gemini` so the
runtime reports a provider-specific auth/configuration error instead of treating
all OAuth providers as unsupported.

The first recovered OAuth path is Kimi: when a local Kimi access token is
present, OpenGate forwards OpenAI chat-completions requests to the Kimi coding
endpoint with the recovered Kimi CLI headers. The historical Kimi refresh/login
flow still needs a new login flow in the current app.

ChatGPT/Codex and Gemini now keep their auth boundary explicit, but their
historical adapters depend on translation/setup flows that are not fully
integrated into this OpenAI chat-completions runtime yet. With auth present they
return a clear `501` provider message instead of claiming full support.

OAuth secrets live outside route profiles and project markers. The default
local store is:

```text
~/.opengate/auth.json
```

Override the path with `OPENGATE_AUTH_PATH` when needed. The store is shaped as
an object with a `providers` map. Records may be keyed by the provider id or by
`adapter:provider-id`; a record carries local credential fields such as
`accessToken`, optional refresh metadata, provider-specific headers, and an
optional upstream base URL.

The Providers page can configure that local store for OAuth providers without
editing route-profile JSON or running a CLI command. Create an OAuth provider,
choose the `kimi`, `chatgpt`, or `gemini` adapter, then use its OAuth auth panel
to save or remove local credentials. The UI only reads back auth status flags;
it never receives stored token values after they are written.

Route profile export/import includes only public provider identity such as:

```json
{
  "name": "kimi",
  "type": "oauth",
  "adapter": "kimi"
}
```

It never exports tokens, sessions, API keys, or the local auth store.

## API

Profile-scoped OpenAI-compatible endpoints:

```
GET  /c/{profileSlug}/v1/models
POST /c/{profileSlug}/v1/chat/completions
```

Internal admin endpoints:

```
GET  /_opengate/status
GET  /_opengate/route-profiles
GET  /_opengate/route-profiles/{slug}/resolved
GET  /_opengate/route-profiles/{slug}/graph-design
GET  /_opengate/route-profiles/{slug}/graph-runtime
GET  /_opengate/presets
POST /_opengate/presets/{id}/copy
GET  /_opengate/providers/{id}/auth
POST /_opengate/providers/{id}/auth
DELETE /_opengate/providers/{id}/auth
POST /_opengate/playground
```

## License

MIT
