import { Hono } from "hono"
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { serve as nodeServe } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { swaggerUI } from "@hono/swagger-ui"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"
import { createLogger } from "./logger.js"
import { statusRoute } from "./routes/status.js"
import { routeProfileRoutes } from "./routes/route-profiles.js"
import { internalRoutes } from "./routes/internal.js"
import { openApiSpec } from "./openapi.js"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { readFile } from "node:fs/promises"

export interface ServeOptions {
  port: number
  db: Kysely<Database>
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticRoot = join(__dirname, "../../../web/dist")

export function serve(opts: ServeOptions) {
  const app = new Hono()
  const log = createLogger("http")

  app.use(logger((msg) => log.info(msg)))
  app.use(cors({ origin: "*" }))

  app.get("/openapi.json", (c) => c.json(openApiSpec))
  app.get("/docs", swaggerUI({ url: "/openapi.json" }))

  app.route("/_opengate/status", statusRoute(opts))
  app.route("/_opengate", internalRoutes(opts))
  app.route("/_opengate/route-profiles", routeProfileRoutes(opts))

  app.route("/c/:profileSlug/v1", routeProfileRoutes(opts))

  app.all("/v1/*", async (c) => {
    const setting = await opts.db
      .selectFrom("settings")
      .select("value_json")
      .where("key", "=", "default_profile_slug")
      .executeTakeFirst()

    const defaultSlug = setting ? JSON.parse(setting.value_json) : undefined
    if (!defaultSlug || typeof defaultSlug !== "string") {
      return c.json(
        { error: "No default route profile configured. Use /c/{profileSlug}/v1." },
        404,
      )
    }

    const url = new URL(c.req.url)
    const rest = url.pathname.replace(/^\/v1/, "")
    const newUrl = `/c/${defaultSlug}/v1${rest}${url.search}`
    return c.redirect(newUrl, 307)
  })

  // Static web UI (production build); API routes above take priority
  app.use("/*", serveStatic({ root: staticRoot }))

  // SPA fallback for React Router
  app.get("/*", async (c) => {
    try {
      const index = await readFile(join(staticRoot, "index.html"), "utf-8")
      return c.html(index)
    } catch {
      return c.notFound()
    }
  })

  const server = nodeServe({
    port: opts.port,
    fetch: app.fetch,
  })

  return {
    port: opts.port,
    stop: () => server.close(),
  }
}
