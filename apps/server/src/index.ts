import { serve } from "./server.js"
import { getConfig } from "./config.js"
import { createLogger } from "./logger.js"
import { createDatabaseConnection } from "@opengate/db"
import { migrateToLatest, seedDefaults } from "@opengate/db"

const log = createLogger("main")

async function main() {
  const config = getConfig()
  const db = createDatabaseConnection(config.databasePath)

  await migrateToLatest(db)
  await seedDefaults(db)

  const { stop, port } = serve({ port: config.port, db })

  log.info({ port, database: config.databasePath }, "server.started")

  process.on("SIGINT", () => {
    log.info("server.shutdown")
    stop()
    process.exit(0)
  })

  process.on("SIGTERM", () => {
    log.info("server.shutdown")
    stop()
    process.exit(0)
  })
}

main().catch((err) => {
  log.error({ err: String(err) }, "main.fatal")
  process.exit(1)
})
