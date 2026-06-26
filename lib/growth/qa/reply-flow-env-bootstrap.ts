/**
 * Production env bootstrap for Growth QA / audit CLI scripts.
 * No server-only imports — safe for unit tests.
 */

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

/** Pulled Vercel Production env — canonical for local build/cert workflows (BUILD-ENV-1). */
export const GROWTH_VERCEL_BUILD_ENV_FILE = ".env.build" as const

/** Later entries override earlier entries when merged. */
export const GROWTH_PRODUCTION_ENV_SOURCES = [
  GROWTH_VERCEL_BUILD_ENV_FILE,
  ".env.vercel.production",
] as const

export const GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "EQUIPIFY_PLATFORM_ADMIN_EMAILS",
] as const

export type GrowthReplyFlowRequiredEnvKey = (typeof GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS)[number]

export type GrowthProductionEnvBootstrapResult = {
  ok: boolean
  found: Partial<Record<GrowthReplyFlowRequiredEnvKey, string>>
  missing: GrowthReplyFlowRequiredEnvKey[]
  sources: Partial<Record<GrowthReplyFlowRequiredEnvKey, string>>
  loadedFiles: string[]
  skippedFiles: string[]
  supabaseUrlMapped: boolean
}

function trimEnvValue(value: string): string {
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1)
  }
  return trimmed.trim()
}

function isEnvKeyLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return false
  if (trimmed.startsWith("export ")) {
    const rest = trimmed.slice(7).trim()
    return /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest)
  }
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)
}

/** Parse KEY=VALUE lines from a dotenv file (no process.env mutation). */
export function parseGrowthProductionEnvFile(
  filePath: string,
  raw = readFileSync(filePath, "utf8"),
): Record<string, string> {
  const parsed: Record<string, string> = {}

  for (const line of raw.split("\n")) {
    if (!isEnvKeyLine(line)) continue

    let trimmed = line.trim()
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trim()

    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue

    const key = trimmed.slice(0, eq).trim()
    const value = trimEnvValue(trimmed.slice(eq + 1))
    if (!key) continue

    parsed[key] = value
  }

  return parsed
}

function isPresentEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/** Merge env files in order; later files override earlier keys. */
export function mergeGrowthProductionEnvLayers(
  layers: Array<{ source: string; values: Record<string, string> }>,
): { merged: Record<string, string>; sources: Record<string, string> } {
  const merged: Record<string, string> = {}
  const sources: Record<string, string> = {}

  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer.values)) {
      if (!isPresentEnvValue(value)) continue
      merged[key] = value.trim()
      sources[key] = layer.source
    }
  }

  return { merged, sources }
}

export function applySupabaseUrlPublicAlias(env: Record<string, string>): {
  env: Record<string, string>
  mapped: boolean
} {
  const next = { ...env }
  if (!isPresentEnvValue(next.NEXT_PUBLIC_SUPABASE_URL) && isPresentEnvValue(next.SUPABASE_URL)) {
    next.NEXT_PUBLIC_SUPABASE_URL = next.SUPABASE_URL.trim()
    return { env: next, mapped: true }
  }
  return { env: next, mapped: false }
}

function pickProcessEnvLayer(
  env: NodeJS.ProcessEnv,
): { source: string; values: Record<string, string> } {
  const values: Record<string, string> = {}
  const keys = new Set<string>([
    ...GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS,
    "SUPABASE_URL",
    "PLATFORM_ADMIN_EMAILS",
    "PLATFORM_ADMIN_EMAIL",
  ])

  for (const key of keys) {
    const value = env[key]
    if (isPresentEnvValue(value)) values[key] = value.trim()
  }

  return { source: "(environment)", values }
}

export function bootstrapGrowthProductionEnv(input?: {
  cwd?: string
  sources?: readonly string[]
  preloadedEnv?: Record<string, string>
  /** When true, non-empty `process.env` values fill gaps after file merge (supports `vercel env run`). */
  inheritProcessEnv?: boolean
  processEnv?: NodeJS.ProcessEnv
}): GrowthProductionEnvBootstrapResult {
  const cwd = input?.cwd ?? process.cwd()
  const sourceFiles = input?.sources ?? GROWTH_PRODUCTION_ENV_SOURCES
  const inheritProcessEnv = input?.inheritProcessEnv ?? true
  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const loadedFiles: string[] = []
  const skippedFiles: string[] = []

  if (input?.preloadedEnv) {
    layers.push({ source: "(preloaded)", values: input.preloadedEnv })
  }

  if (inheritProcessEnv) {
    layers.push(pickProcessEnvLayer(input?.processEnv ?? process.env))
  }

  for (const relativePath of sourceFiles) {
    const absolutePath = resolve(cwd, relativePath)
    if (!existsSync(absolutePath)) {
      skippedFiles.push(relativePath)
      continue
    }

    try {
      const values = parseGrowthProductionEnvFile(absolutePath)
      layers.push({ source: relativePath, values })
      loadedFiles.push(relativePath)
    } catch {
      skippedFiles.push(relativePath)
    }
  }

  const { merged, sources } = mergeGrowthProductionEnvLayers(layers)
  const { env: withAlias, mapped: supabaseUrlMapped } = applySupabaseUrlPublicAlias(merged)

  const found: Partial<Record<GrowthReplyFlowRequiredEnvKey, string>> = {}
  const keySources: Partial<Record<GrowthReplyFlowRequiredEnvKey, string>> = {}
  const missing: GrowthReplyFlowRequiredEnvKey[] = []

  for (const key of GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS) {
    const value = withAlias[key]
    if (isPresentEnvValue(value)) {
      found[key] = value
      if (key === "NEXT_PUBLIC_SUPABASE_URL" && supabaseUrlMapped && !isPresentEnvValue(merged.NEXT_PUBLIC_SUPABASE_URL)) {
        keySources[key] = `${sources.SUPABASE_URL ?? "SUPABASE_URL"} (mapped to NEXT_PUBLIC_SUPABASE_URL)`
      } else {
        keySources[key] = sources[key] ?? (input?.preloadedEnv?.[key] ? "(preloaded)" : "(unknown)")
      }
    } else {
      missing.push(key)
    }
  }

  return {
    ok: missing.length === 0,
    found,
    missing,
    sources: keySources,
    loadedFiles,
    skippedFiles,
    supabaseUrlMapped,
  }
}

/** Load env files into `process.env` and return validation result. */
export function loadGrowthProductionEnvIntoProcess(input?: {
  cwd?: string
  sources?: readonly string[]
  inheritProcessEnv?: boolean
}): GrowthProductionEnvBootstrapResult {
  const result = bootstrapGrowthProductionEnv(input)

  for (const key of GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS) {
    const value = result.found[key]
    if (value) process.env[key] = value
  }

  if (result.found.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = result.found.NEXT_PUBLIC_SUPABASE_URL
  }

  return result
}

export function formatGrowthProductionEnvBootstrapReport(
  result: GrowthProductionEnvBootstrapResult,
): string {
  const lines: string[] = []

  lines.push("Growth production env bootstrap")
  lines.push("")
  lines.push(`Loaded files: ${result.loadedFiles.length > 0 ? result.loadedFiles.join(", ") : "(none)"}`)
  if (result.skippedFiles.length > 0) {
    lines.push(`Skipped/missing files: ${result.skippedFiles.join(", ")}`)
  }
  if (result.supabaseUrlMapped) {
    lines.push("Mapped SUPABASE_URL -> NEXT_PUBLIC_SUPABASE_URL")
  }
  lines.push("")

  lines.push("FOUND:")
  if (Object.keys(result.sources).length === 0) {
    lines.push("  (none)")
  } else {
    for (const key of GROWTH_REPLY_FLOW_REQUIRED_ENV_KEYS) {
      const source = result.sources[key]
      if (source) lines.push(`  ${key} -> ${source}`)
    }
  }

  lines.push("")
  lines.push("MISSING:")
  if (result.missing.length === 0) {
    lines.push("  (none)")
  } else {
    for (const key of result.missing) {
      lines.push(`  ${key}`)
    }
  }

  if (!result.ok) {
    lines.push("")
    lines.push("Fix: pull Vercel Production env or run with vercel env run:")
    lines.push("  pnpm env:pull:production")
    lines.push("  vercel env run -e production -- pnpm qa:growth-reply-flow -- ...")
  }

  return lines.join("\n")
}

export function assertGrowthProductionEnvReady(input?: {
  cwd?: string
  sources?: readonly string[]
}): GrowthProductionEnvBootstrapResult {
  const result = loadGrowthProductionEnvIntoProcess(input)
  const report = formatGrowthProductionEnvBootstrapReport(result)
  console.log(report)

  if (!result.ok) {
    throw new Error("Growth production env bootstrap failed — required keys missing.")
  }

  return result
}
