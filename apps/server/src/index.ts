import { serve } from "./server.js"
import { getConfig } from "./config.js"
import { createLogger } from "./logger.js"
import { createDatabaseConnection } from "@opengate/db"
import { migrateToLatest, seedDefaults } from "@opengate/db"
import { spawn } from "node:child_process"

const log = createLogger("main")

function parseOverrides(args: string[]) {
  const portFlag = args.find((a) => a.startsWith("--port="))
  const dbFlag = args.find((a) => a.startsWith("--db="))
  const noOpen = args.includes("--no-open")
  return {
    port: portFlag ? Number(portFlag.split("=")[1]) : undefined,
    databasePath: dbFlag ? dbFlag.split("=")[1] : undefined,
    noOpen,
  }
}

async function main() {
  const overrides = parseOverrides(process.argv.slice(2))
  const env = getConfig()
  const config = {
    port: overrides.port ?? env.port,
    databasePath: overrides.databasePath ?? env.databasePath,
    logLevel: env.logLevel,
    defaultProfileSlug: env.defaultProfileSlug,
  }

  const db = createDatabaseConnection(config.databasePath)

  await migrateToLatest(db)
  await seedDefaults(db)

  const { stop, port } = serve({ port: config.port, db })

  const url = `http://localhost:${port}`
  log.info({ port, database: config.databasePath }, "server.started")
  console.log(`OpenGate listening on ${url}`)
  console.log(`Status: ${url}/_opengate/status`)

  if (!overrides.noOpen) {
    try {
      const cmd =
        process.platform === "win32"
          ? "start"
          : process.platform === "darwin"
            ? "open"
            : "xdg-open"
      spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref()
    } catch {
      // ignore open failure
    }
  }

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
