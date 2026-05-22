import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import type { OAuthAuthRecord, OAuthAuthStore, OAuthProviderRef } from "./types.js"

interface AuthFile {
  version: 1
  providers: Record<string, OAuthAuthRecord>
}

export function defaultAuthPath(): string {
  return process.env.OPENGATE_AUTH_PATH || join(homedir(), ".opengate", "auth.json")
}

export function authRecordKeys(ref: OAuthProviderRef): string[] {
  return [
    ref.id,
    `${ref.adapter}:${ref.id}`,
    `${ref.adapter}:${ref.name}`,
    ref.name,
  ]
}

export class FileOAuthAuthStore implements OAuthAuthStore {
  constructor(private readonly path = defaultAuthPath()) {}

  async load(ref: OAuthProviderRef): Promise<OAuthAuthRecord | undefined> {
    const authFile = await readAuthFile(this.path)
    for (const key of authRecordKeys(ref)) {
      const record = authFile.providers[key]
      if (record) return record
    }
    return undefined
  }
}

export const defaultOAuthAuthStore = new FileOAuthAuthStore()

export async function saveAuthRecord(
  ref: OAuthProviderRef,
  record: OAuthAuthRecord,
  path = defaultAuthPath(),
): Promise<void> {
  const current = await readAuthFile(path)
  current.providers[`${ref.adapter}:${ref.id}`] = record

  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, JSON.stringify(current, null, 2), { encoding: "utf8", mode: 0o600 })
  await rename(tempPath, path)
  await chmod(path, 0o600).catch(() => undefined)
}

async function readAuthFile(path: string): Promise<AuthFile> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<AuthFile>
    return {
      version: 1,
      providers:
        parsed.providers && typeof parsed.providers === "object"
          ? (parsed.providers as Record<string, OAuthAuthRecord>)
          : {},
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: 1, providers: {} }
    }
    throw new Error(`Could not read OpenGate OAuth auth store at ${path}: ${String(err)}`)
  }
}
