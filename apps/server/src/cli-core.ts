import { getConfig } from "./config.js"
import { createDatabaseConnection } from "@opengate/db"
import { migrateToLatest, seedDefaults } from "@opengate/db"
import { serve } from "./server.js"
import { createLogger } from "./logger.js"
import { exportRouteProfile, importRouteProfile } from "@opengate/core"
import { existsSync } from "node:fs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve, basename } from "node:path"
import { spawn } from "node:child_process"

const log = createLogger("cli")
const VERSION = "0.1.0"

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

export async function parseArgsAndRun(options?: {
  injectSpaFallback?: () => string
}) {
  const args = process.argv.slice(2)
  const [cmd, ...rest] = args

  if (cmd === "--version" || cmd === "-v" || cmd === "version") {
    console.log(`OpenGate ${VERSION}`)
    return
  }

  if (!cmd || cmd === "serve") {
    const overrides = parseOverrides(args)
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
    const { port } = serve({
      port: config.port,
      db,
      spaHtml: options?.injectSpaFallback?.(),
    })
    const url = `http://localhost:${port}`
    console.log(`OpenGate listening on ${url}`)
    console.log(`Status: ${url}/_opengate/status`)
    if (!overrides.noOpen) {
      try {
        const openCmd =
          process.platform === "win32"
            ? "start"
            : process.platform === "darwin"
              ? "open"
              : "xdg-open"
        spawn(openCmd, [url], { detached: true, stdio: "ignore" }).unref()
      } catch {
        // ignore
      }
    }
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
      const marker = JSON.parse(readFileSync(markerPath, "utf-8"))
      const slug = marker.routeProfile ?? marker.profileSlug
      console.log(`Project binding: ${slug ?? "unknown"}`)
      if (marker.baseUrl) {
        console.log(`Base URL: ${marker.baseUrl}`)
      }
    } else {
      console.log("No project binding found. Run `opengate init` to bind.")
    }
    return
  }

  if (cmd === "export") {
    const profileFlag = rest.find((a: string) => a.startsWith("--profile="))
    const profileSlug = profileFlag ? profileFlag.split("=")[1] : rest[0]
    if (!profileSlug) {
      console.error("Usage: opengate export --profile=<slug> > file.json")
      process.exit(2)
    }
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    const exported = await exportRouteProfile(db, profileSlug)
    console.log(JSON.stringify(exported, null, 2))
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
    const data = JSON.parse(readFileSync(filePath, "utf-8"))
    const targetSlugFlag = rest.find((a: string) => a.startsWith("--slug="))
    const overwriteFlag = rest.includes("--overwrite")
    const result = await importRouteProfile(db, data, {
      targetSlug: targetSlugFlag ? targetSlugFlag.split("=")[1] : undefined,
      overwrite: overwriteFlag,
    })
    console.log(`Imported route profile: ${result.slug} (${result.profileId})`)
    return
  }

  if (cmd === "init") {
    const config = getConfig()
    const db = createDatabaseConnection(config.databasePath)
    await migrateToLatest(db)
    await seedDefaults(db)

    const cwd = resolve(".")
    const projectName = basename(cwd)

    const profiles = await db
      .selectFrom("route_profiles")
      .select(["id", "slug", "name"])
      .execute()

    if (profiles.length === 0) {
      console.error("No route profiles found. Ensure seeding succeeded.")
      process.exit(1)
    }

    // Pick first non-default profile or the only one
    const chosen = profiles.find((p) => p.slug !== "default") ?? profiles[0]

    const markerDir = join(cwd, ".opengate")
    mkdirSync(markerDir, { recursive: true })

    const baseUrl = `http://localhost:${config.port}/c/${chosen.slug}/v1`

    const marker = {
      schemaVersion: 1,
      routeProfile: chosen.slug,
      baseUrl,
      projectName,
      createdAt: new Date().toISOString(),
    }

    writeFileSync(join(markerDir, "profile.json"), JSON.stringify(marker, null, 2))

    // Upsert project binding
    const existingBinding = await db
      .selectFrom("project_bindings")
      .select("id")
      .where("project_root", "=", cwd)
      .executeTakeFirst()

    if (existingBinding) {
      await db
        .updateTable("project_bindings")
        .set({
          route_profile_id: chosen.id,
          project_name: projectName,
          marker_path: join(markerDir, "profile.json"),
          updated_at: new Date().toISOString(),
        })
        .where("id", "=", existingBinding.id)
        .execute()
    } else {
      const { randomUUID } = await import("node:crypto")
      await db
        .insertInto("project_bindings")
        .values({
          id: randomUUID(),
          route_profile_id: chosen.id,
          project_root: cwd,
          project_name: projectName,
          marker_path: join(markerDir, "profile.json"),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute()
    }

    console.log(`Created .opengate/profile.json`)
    console.log(`Client base URL: ${baseUrl}`)
    return
  }

  usageAndExit()
}

function usageAndExit(): never {
  console.log(`Usage:
  opengate serve                          Start server
  opengate serve --port=18765             Start server on custom port
  opengate serve --db=./custom.db         Start server with custom DB
  opengate serve --no-open                Start server without opening browser
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
