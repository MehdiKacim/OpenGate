#!/usr/bin/env bun
import { startServer } from "./server.ts"
import { createLogger, logFile } from "./log.ts"
import { port as configPort, getConfig, aliasProvider as configAliasProvider } from "./config.ts"
import { configDir } from "./paths.ts"
import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  allProviders,
  allSupportedModels,
  allAdapters,
  getProvider,
  listProviders,
  listAdapters,
} from "./providers/registry.ts"
import { listProfiles } from "./profiles.ts"
import type { CliHandlers } from "./providers/types.ts"

declare const BUILD_VERSION: string | undefined
const VERSION = typeof BUILD_VERSION === "string" ? BUILD_VERSION : "dev"

const log = createLogger("cli")

async function main() {
  const args = process.argv.slice(2)
  const [first, ...rest] = args

  if (first === "--version" || first === "-v" || first === "version") {
    console.log(`OpenGate ${VERSION}`)
    return
  }

  if (!first || first === "serve") {
    const port = configPort()
    startServer({ port })
    console.log(`OpenGate listening on http://localhost:${port}`)
    console.log(`Logs: ${logFile()}`)
    printConfigSummary()
    console.log()
    console.log("OpenAI-compatible endpoint:")
    console.log(`  http://localhost:${port}/v1/models`)
    console.log(`  http://localhost:${port}/v1/chat/completions`)
    console.log()
    console.log("Anthropic-compatible endpoint:")
    console.log(`  http://localhost:${port}/v1/messages`)
    console.log()
    console.log("Profiles:")
    for (const p of listProfiles()) {
      console.log(`  ${p}`)
    }
    console.log()
    console.log("Providers:")
    printSupportedModels()
    console.log()
    console.log("Configure your client:")
    console.log(`  # OpenAI-compatible (Continue.dev, Roo, OpenWebUI, etc.)`)
    console.log(`  export OPENAI_BASE_URL="http://localhost:${port}/v1"`)
    console.log(`  export OPENAI_API_KEY="anything"`)
    console.log(`  export OPENAI_MODEL="gpt-5.4"`)
    console.log()
    console.log(`  # Or use a profile:`)
    console.log(`  export OPENAI_MODEL="architect"`)
    console.log()
    console.log(`  # Anthropic-compatible (Claude Code)`)
    console.log(`  export ANTHROPIC_BASE_URL="http://localhost:${port}"`)
    console.log(`  export ANTHROPIC_AUTH_TOKEN="anything"`)
    console.log(`  export ANTHROPIC_MODEL="kimi-for-coding[1m]"`)
    return
  }

  if (first === "profiles") {
    console.log("Available profiles:")
    for (const p of listProfiles()) {
      console.log(`  ${p}`)
    }
    return
  }

  if (listProviders().includes(first)) {
    const provider = getProvider(first)
    await runProviderCommand(provider.name, provider.cli, rest)
    return
  }

  usageAndExit()
}

async function runProviderCommand(name: string, cli: CliHandlers, args: string[]): Promise<void> {
  const [group, sub] = args
  if (group !== "auth") usageAndExit()

  switch (sub) {
    case "login":
      if (!cli.login) {
        console.error(`${name}: browser login not supported`)
        process.exit(2)
      }
      await cli.login()
      process.exit(0)
    case "device":
      if (!cli.device) {
        console.error(`${name}: device login not supported`)
        process.exit(2)
      }
      await cli.device()
      process.exit(0)
    case "status":
      await cli.status()
      return
    case "logout":
      await cli.logout()
      return
    default:
      usageAndExit()
  }
}

function usageAndExit(): never {
  const providers = listProviders().join("|")
  const models = allSupportedModels()
    .map((m) => `${m.model} (${m.provider})`)
    .join(", ")
  console.log(`Usage:
  opengate serve                               Run gateway (PORT env or config.json port, default 18765)
  opengate profiles                            List available profiles
  opengate <provider> auth login               Browser OAuth
  opengate <provider> auth device              Device-code OAuth
  opengate <provider> auth status              Show current auth
  opengate <provider> auth logout              Clear stored auth
  opengate --version                           Show version

Providers: ${providers}
Models:    ${models}
`)
  process.exit(2)
}

function printSupportedModels(): void {
  const groups = new Map<string, string[]>()
  for (const { model, provider } of allSupportedModels()) {
    const models = groups.get(provider) ?? []
    models.push(model)
    groups.set(provider, models)
  }
  for (const provider of listProviders()) {
    const models = groups.get(provider) ?? []
    console.log(`  ${provider}: ${models.join(", ")}`)
  }
}

function printConfigSummary(): void {
  const cfg = getConfig()
  const fromFile = cfg.file
  const overrides: string[] = []

  const configPath = join(configDir(), "config.json")
  if (existsSync(configPath)) {
    console.log(`Config: ${configPath}`)
  }

  if (cfg.env.CCP_CODEX_ORIGINATOR) overrides.push("CCP_CODEX_ORIGINATOR (env)")
  else if (fromFile.codex?.originator) overrides.push("codex.originator (config)")

  if (cfg.env.CCP_CODEX_USER_AGENT) overrides.push("CCP_CODEX_USER_AGENT (env)")
  else if (cfg.env.CCP_USER_AGENT) overrides.push("CCP_USER_AGENT (env)")
  else if (fromFile.codex?.userAgent) overrides.push("codex.userAgent (config)")

  if (cfg.env.CCP_KIMI_USER_AGENT) overrides.push("CCP_KIMI_USER_AGENT (env)")
  else if (fromFile.kimi?.userAgent) overrides.push("kimi.userAgent (config)")

  if (cfg.env.CCP_CODEX_MODEL) overrides.push("CCP_CODEX_MODEL (env)")
  else if (fromFile.codex?.model) overrides.push("codex.model (config)")

  if (cfg.env.CCP_CODEX_EFFORT) overrides.push("CCP_CODEX_EFFORT (env)")
  else if (fromFile.codex?.effort) overrides.push("codex.effort (config)")

  if (cfg.env.CCP_CODEX_SERVICE_TIER) overrides.push("CCP_CODEX_SERVICE_TIER (env)")
  else if (fromFile.codex?.serviceTier) overrides.push("codex.serviceTier (config)")

  if (cfg.env.CCP_CODEX_BASE_URL) overrides.push("CCP_CODEX_BASE_URL (env)")
  else if (fromFile.codex?.baseUrl) overrides.push("codex.baseUrl (config)")

  if (cfg.env.CCP_ALIAS_PROVIDER) overrides.push(`CCP_ALIAS_PROVIDER=${configAliasProvider()} (env)`)
  else if (fromFile.aliasProvider) overrides.push(`aliasProvider=${fromFile.aliasProvider} (config)`)

  if (cfg.env.CCP_LOG_VERBOSE !== undefined) overrides.push("CCP_LOG_VERBOSE (env)")
  else if (fromFile.log?.verbose) overrides.push("log.verbose (config)")

  if (cfg.env.CCP_LOG_STDERR !== undefined) overrides.push("CCP_LOG_STDERR (env)")
  else if (fromFile.log?.stderr) overrides.push("log.stderr (config)")

  if (cfg.env.CCP_KIMI_OAUTH_HOST) overrides.push("CCP_KIMI_OAUTH_HOST (env)")
  else if (fromFile.kimi?.oauthHost) overrides.push("kimi.oauthHost (config)")

  if (cfg.env.CCP_KIMI_BASE_URL) overrides.push("CCP_KIMI_BASE_URL (env)")
  else if (fromFile.kimi?.baseUrl) overrides.push("kimi.baseUrl (config)")

  if (overrides.length > 0) {
    console.log("Overrides:")
    for (const o of overrides) {
      console.log(`  ${o}`)
    }
  }
}

main().catch((err) => {
  log.error("cli fatal", { err: String(err), stack: (err as Error)?.stack })
  console.error(err)
  process.exit(1)
})
