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

Download `opengate-windows-x64.zip` from the release artifacts, extract, and run:

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
- `packages/providers` — Provider adapters (static, proxy, oauth)
- `packages/routing` — Routing resolution engine
- `packages/shared` — Shared types and schemas
- `packages/sdk` — Client SDK placeholder

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
POST /_opengate/playground
```

## License

MIT
