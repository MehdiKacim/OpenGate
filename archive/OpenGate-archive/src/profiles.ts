import { getConfig } from "./config.ts"

export interface Profile {
  provider: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
}

const BUILTIN_PROFILES: Record<string, Profile> = {
  architect: {
    provider: "codex",
    model: "gpt-5.4",
    systemPrompt:
      "Focus on planning, architecture, ambiguity resolution. Think deeply about design before implementation.",
  },
  builder: {
    provider: "kimi",
    model: "kimi-for-coding",
    systemPrompt:
      "Focus on implementation, coding, mechanical refactors. Write clean, working code.",
  },
  "commit-writer": {
    provider: "local",
    model: "commit-writer",
    systemPrompt: "Generate concise, meaningful commit messages from diffs.",
  },
}

export function resolveProfile(name: string): Profile | undefined {
  const cfg = getConfig()
  const fromFile = cfg.file.profiles?.[name]
  if (fromFile) {
    return {
      provider: fromFile.provider,
      model: fromFile.model,
      systemPrompt: fromFile.systemPrompt,
      temperature: fromFile.temperature,
      maxTokens: fromFile.maxTokens,
    }
  }
  return BUILTIN_PROFILES[name]
}

export function listProfiles(): string[] {
  const cfg = getConfig()
  const fromFile = Object.keys(cfg.file.profiles ?? {})
  const builtin = Object.keys(BUILTIN_PROFILES)
  return Array.from(new Set([...builtin, ...fromFile]))
}
