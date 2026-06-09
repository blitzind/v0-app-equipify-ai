/**
 * Apollo live pilot production env bootstrap — no .env.local.
 * Prefer: node scripts/vercel-production-env-run.ts -- pnpm …
 */

import { existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  mergeGrowthProductionEnvLayers,
  parseGrowthProductionEnvFile,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"

export const APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER =
  "apollo-live-pilot-production-env-le-4-v1" as const

/** Production file layers only — never .env.local / .env.local.active */
export const APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES = [
  ".env.production.local",
  ".env.vercel.production",
  ".vercel/.env.production.local",
] as const

export const APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS = [
  "APOLLO_API_KEY",
  "GROWTH_APOLLO_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED",
  "GROWTH_APOLLO_USE_MOCK",
  "GROWTH_APOLLO_LIVE_BENCHMARK_ACK",
  "GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED",
  "GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID",
  "GROWTH_APOLLO_AI_3_OUTPUT_PATH",
] as const

export const APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND =
  "pnpm check:apollo-live-pilot-env-ai-4:production" as const

export const APOLLO_LIVE_PILOT_VERCEL_LIVE_PILOT_COMMAND =
  "pnpm run:le-2-apollo-live-pilot:production" as const

function isPresent(value: string | undefined): value is string {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed !== '""' && trimmed !== "''"
}

export type ApolloLivePilotProtectedEnvSnapshot = Partial<
  Record<(typeof APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS)[number], string>
>

export function snapshotApolloLivePilotProtectedEnv(
  env: NodeJS.ProcessEnv = process.env,
): ApolloLivePilotProtectedEnvSnapshot {
  const snapshot: ApolloLivePilotProtectedEnvSnapshot = {}
  for (const key of APOLLO_LIVE_PILOT_PROTECTED_ENV_KEYS) {
    const value = env[key]
    if (isPresent(value)) snapshot[key] = value.trim()
  }
  return snapshot
}

export function restoreApolloLivePilotProtectedEnv(
  snapshot: ApolloLivePilotProtectedEnvSnapshot,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (!isPresent(value)) continue
    if (!isPresent(env[key])) {
      env[key] = value
    }
  }
}

export type ApolloLivePilotProductionEnvBootstrapResult = {
  qa_marker: typeof APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER
  loaded_files: string[]
  skipped_files: string[]
  vercel_production_env_run: boolean
  recommended_command: typeof APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND
}

export function bootstrapApolloLivePilotProductionEnv(input?: {
  cwd?: string
  protectedSnapshot?: ApolloLivePilotProtectedEnvSnapshot
}): ApolloLivePilotProductionEnvBootstrapResult {
  const cwd = input?.cwd ?? process.cwd()
  const protectedSnapshot = input?.protectedSnapshot ?? snapshotApolloLivePilotProtectedEnv()
  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const loaded_files: string[] = []
  const skipped_files: string[] = []

  for (const relativePath of APOLLO_LIVE_PILOT_PRODUCTION_ENV_FILE_SOURCES) {
    const absolutePath = resolve(cwd, relativePath)
    if (!existsSync(absolutePath)) {
      skipped_files.push(relativePath)
      continue
    }
    try {
      layers.push({ source: relativePath, values: parseGrowthProductionEnvFile(absolutePath) })
      loaded_files.push(relativePath)
    } catch {
      skipped_files.push(relativePath)
    }
  }

  const { merged } = mergeGrowthProductionEnvLayers(layers)

  // File values fill gaps only — Vercel production pull / process.env wins.
  for (const [key, value] of Object.entries(merged)) {
    if (!isPresent(value)) continue
    if (!isPresent(process.env[key])) {
      process.env[key] = value.trim()
    }
  }

  restoreApolloLivePilotProtectedEnv(protectedSnapshot)

  return {
    qa_marker: APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER,
    loaded_files,
    skipped_files,
    vercel_production_env_run: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
    recommended_command: APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND,
  }
}
