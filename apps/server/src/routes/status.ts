import { Hono } from "hono"
import type { Kysely } from "kysely"
import type { Database } from "@opengate/db"

export interface StatusRouteOptions {
  db: Kysely<Database>
}

export function statusRoute(opts: StatusRouteOptions) {
  const app = new Hono()

  app.get("/", async (c) => {
    const defaultProfile = await opts.db
      .selectFrom("settings")
      .select("value_json")
      .where("key", "=", "default_profile_slug")
      .executeTakeFirst()

    return c.json({
      ok: true,
      version: "0.1.0",
      defaultProfile: defaultProfile ? JSON.parse(defaultProfile.value_json) : null,
    })
  })

  return app
}
