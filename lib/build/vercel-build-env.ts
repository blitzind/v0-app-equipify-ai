/**
 * BUILD-ENV-1 — Vercel Production build env helpers.
 * No server-only imports — safe for build/CLI scripts and unit tests.
 */

import { execSync } from "node:child_process"
import { existsSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import {
  GROWTH_PRODUCTION_ENV_SOURCES,
  applySupabaseUrlPublicAlias,
  parseGrowthProductionEnvFile,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"

export const BUILD_ENV_QA_MARKER = "build-env-1-vercel-production-v1" as const

/** Pulled from Vercel Production — canonical local build env file. */
export const VERCEL_BUILD_ENV_FILE = ".env.build" as const

export { GROWTH_PRODUCTION_ENV_SOURCES as VERCEL_PRODUCTION_ENV_FILE_SOURCES }

/**
 * Legacy env files that must not participate in local production builds.
 * Next.js auto-loads `.env.production.local` during `next build`, which can
 * inject empty placeholders and break module evaluation (e.g. Supabase URL).
 */
export const LEGACY_LOCAL_ENV_FILES = [
  ".env.local",
  ".env.local.active",
  ".env.production.local",
  ".env.local.rebuild",
  ".vercel/.env.production.local",
] as const

export type LegacyLocalEnvFile = (typeof LEGACY_LOCAL_ENV_FILES)[number]

export const PRODUCTION_BUILD_REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

export type ProductionBuildRequiredEnvKey = (typeof PRODUCTION_BUILD_REQUIRED_ENV_KEYS)[number]

export type ProductionBuildEnvAudit = {
  ok: boolean
  missing: ProductionBuildRequiredEnvKey[]
  loaded_pulled_env: boolean
  hidden_legacy_files: string[]
  on_vercel: boolean
}

const LEGACY_ENV_HIDE_SUFFIX = ".equipify-build-hidden"

function isPresentEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function hideLegacyLocalEnvFiles(cwd = process.cwd()): Array<{ path: string; backup: string }> {
  const hidden: Array<{ path: string; backup: string }> = []
  for (const name of LEGACY_LOCAL_ENV_FILES) {
    const path = join(cwd, name)
    if (!existsSync(path)) continue
    const backup = `${path}${LEGACY_ENV_HIDE_SUFFIX}`
    if (existsSync(backup)) unlinkSync(backup)
    execSync(`mv ${JSON.stringify(path)} ${JSON.stringify(backup)}`)
    hidden.push({ path, backup })
  }
  return hidden
}

export function restoreLegacyLocalEnvFiles(
  hidden: Array<{ path: string; backup: string }>,
): void {
  for (const { path, backup } of hidden) {
    if (!existsSync(backup)) continue
    if (existsSync(path)) unlinkSync(path)
    execSync(`mv ${JSON.stringify(backup)} ${JSON.stringify(path)}`)
  }
}

export function loadVercelBuildEnvFileIntoProcess(input?: {
  cwd?: string
  filePath?: string
}): boolean {
  const cwd = input?.cwd ?? process.cwd()
  const relativePath = input?.filePath ?? VERCEL_BUILD_ENV_FILE
  const absolutePath = join(cwd, relativePath)
  if (!existsSync(absolutePath)) return false

  const parsed = parseGrowthProductionEnvFile(absolutePath)
  const { env: withAlias } = applySupabaseUrlPublicAlias(parsed)
  for (const [key, value] of Object.entries(withAlias)) {
    if (!isPresentEnvValue(value)) continue
    process.env[key] = value.trim()
  }
  return true
}

export function auditProductionBuildEnv(): ProductionBuildEnvAudit {
  const missing = PRODUCTION_BUILD_REQUIRED_ENV_KEYS.filter(
    (key) => !isPresentEnvValue(process.env[key]),
  )
  return {
    ok: missing.length === 0,
    missing,
    loaded_pulled_env: false,
    hidden_legacy_files: [],
    on_vercel: process.env.VERCEL === "1",
  }
}

export function formatProductionBuildEnvFailure(audit: ProductionBuildEnvAudit): string {
  const lines = [
    "[build-env] Production build env is incomplete.",
    "",
    `Missing: ${audit.missing.join(", ") || "(none)"}`,
    "",
    "Local production builds must use Vercel Production env — not .env.local or .env.production.local.",
    "",
    "Option A (recommended — no env file on disk):",
    "  pnpm build:production",
    "",
    "Option B (pull then build):",
    "  pnpm env:pull:production",
    "  set -a && source .env.build && set +a",
    "  pnpm build:production:pulled",
    "",
    "Option C (manual one-shot):",
    "  vercel env run -e production -- pnpm exec next build",
    "",
    "Note: Vercel encrypts Production secrets — `vercel env pull` and `vercel env run` may",
    "materialize empty placeholders locally. Full production builds with encrypted vars",
    "run on Vercel CI, or export non-empty values into the shell from your team vault.",
  ]
  return lines.join("\n")
}

export function assertProductionBuildEnvReady(): void {
  const audit = auditProductionBuildEnv()
  if (audit.ok) return
  console.error(formatProductionBuildEnvFailure(audit))
  process.exit(1)
}
