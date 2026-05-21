#!/usr/bin/env node
import { getConfig } from "./config.js"
import { createDatabaseConnection } from "@opengate/db"
import { migrateToLatest, seedDefaults } from "@opengate/db"
import { serve } from "./server.js"
import { createLogger } from "./logger.js"
import { existsSync } from "node:fs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const log = createLogger("cli")
const VERSION = "0.1.0"

async function main() {
  const args = process.argv.slice(2)
  const [cmd, ...rest] = args

  if (cmd === "--version" || cmd === "-v" || cmd === "version") {
    console.log(`OpenGate ${VERSION}`)
    return
  }

  if (!cmd || cmd === "serve") {
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    await seedDefaults(db)
    const { port } = serve({ port: config.port, db })
    console.log(`OpenGate listening on http://localhost:${port}`)
    console.log(`Status: http://localhost:${port}/_opengate/status`)
    return
  }

  if (cmd === "seed") {
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    await seedDefaults(db)
    console.log("Seeded defaults.")
    return
  }

  if (cmd === "validate") {
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    console.log("Validation passed.")
    return
  }

  if (cmd === "status") {
    const config = getConfig()
    console.log(`Server URL: http://localhost:${config.port}`)
    console.log(`Database: ${config.databasePath}`)
    const markerPath = join(resolve("."), ".opengate", "profile.json")
    if (existsSync(markerPath)) {
      const marker = JSON.parse(require("node:fs").readFileSync(markerPath, "utf-8"))
      console.log(`Project binding: ${marker.profileSlug}`)
    } else {
      console.log("No project binding found. Run `opengate init` to bind.")
    }
    return
  }

  if (cmd === "export") {
    const profileFlag = rest.find((a) => a.startsWith("--profile="))
    const profileSlug = profileFlag ? profileFlag.split("=")[1] : rest[0]
    if (!profileSlug) {
      console.error("Usage: opengate export --profile=<slug>")
      process.exit(2)
    }
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    const profile = await db
      .selectFrom("route_profiles")
      .selectAll()
      .where("slug", "=", profileSlug)
      .executeTakeFirst()
    if (!profile) {
      console.error(`Profile not found: ${profileSlug}`)
      process.exit(1)
    }
    console.log(JSON.stringify(profile, null, 2))
    return
  }

  if (cmd === "import") {
    const filePath = rest[0]
    if (!filePath) {
      console.error("Usage: opengate import <file.json>")
      process.exit(2)
    }
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    const data = JSON.parse(require("node:fs").readFileSync(filePath, "utf-8"))
    console.log("Import validation passed (not yet implemented transactionally).")
    console.log(JSON.stringify(data, null, 2))
    return
  }

  if (cmd === "init") {
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    await seedDefaults(db)

    const cwd = resolve(".")
    const profiles = await db
      .selectFrom("route_profiles")
      .select(["slug", "name"])
      .execute()

    console.log("Available route profiles:")
    for (const p of profiles) {
      console.log(`  ${p.slug} — ${p.name}`)
    }

    const chosenSlug = profiles[0]?.slug || "default"
    const markerDir = join(cwd, ".opengate")
    mkdirSync(markerDir, { recursive: true })
    writeFileSync(
      join(markerDir, "profile.json"),
      JSON.stringify({ profileSlug: chosenSlug }, null, 2),
    )

    console.log(`Created .opengate/profile.json with profile: ${chosenSlug}`)
    console.log(`Client base URL: http://localhost:${config.port}/c/${chosenSlug}/v1`)
    return
  }

  usageAndExit()
}

function usageAndExit(): never {
  console.log(`Usage:
  opengate serve                          Start server
  opengate seed                           Seed default presets
  opengate validate                       Validate DB and config
  opengate status                         Show server and binding status
  opengate export --profile=<slug>        Export route profile JSON
  opengate import <file.json>             Import route profile JSON
  opengate init                           Bind current project to a route profile
  opengate --version                      Show version
`)
  process.exit(2)
}

main().catch((err) => {
  log.error({ err: String(err) }, "cli.fatal")
  console.error(err)
  process.exit(1)
})
