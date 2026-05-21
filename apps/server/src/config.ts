import { homedir } from "node:os"
import { join } from "node:path"

export interface ServerConfig {
  port: number
  databasePath: string
  logLevel: string
  defaultProfileSlug: string | null
}

function configDir(): string {
  const platform = process.platform
  if (platform === "win32") {
    return join(process.env.APPDATA || homedir(), "opengate")
  }
  return join(homedir(), ".config", "opengate")
}

export function getConfig(): ServerConfig {
  return {
    port: Number(process.env.OPENGATE_PORT || 18765),
    databasePath: process.env.OPENGATE_DB || join(configDir(), "opengate.db"),
    logLevel: process.env.OPENGATE_LOG_LEVEL || "info",
    defaultProfileSlug: process.env.OPENGATE_DEFAULT_PROFILE || null,
  }
}
