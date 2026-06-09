/**
 * Apollo live pilot production env bootstrap — no .env.local.
 * Prefer: vercel env run -e production -- pnpm …
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

export const APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND =
  "vercel env run -e production -- pnpm run:le-2-apollo-live-pilot" as const

export const APOLLO_LIVE_PILOT_VERCEL_PREFLIGHT_COMMAND =
  "vercel env run -e production -- pnpm check:apollo-live-pilot-env-ai-4" as const

function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export type ApolloLivePilotProductionEnvBootstrapResult = {
  qa_marker: typeof APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER
  loaded_files: string[]
  skipped_files: string[]
  /** True when Apollo/Supabase keys were already in process.env (typical with vercel env run). */
  vercel_env_run_detected: boolean
  recommended_command: typeof APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND
}

export function bootstrapApolloLivePilotProductionEnv(input?: {
  cwd?: string
}): ApolloLivePilotProductionEnvBootstrapResult {
  const cwd = input?.cwd ?? process.cwd()
  const layers: Array<{ source: string; values: Record<string, string> }> = []
  const loaded_files: string[] = []
  const skipped_files: string[] = []

  const hadApolloKeyBefore =
    isPresent(process.env.APOLLO_API_KEY) || isPresent(process.env.GROWTH_APOLLO_API_KEY)
  const hadSupabaseBefore = isPresent(process.env.SUPABASE_SERVICE_ROLE_KEY)

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

  // File values fill gaps only — vercel env run / exported process.env wins.
  for (const [key, value] of Object.entries(merged)) {
    if (isPresent(value) && !isPresent(process.env[key])) {
      process.env[key] = value.trim()
    }
  }

  const vercel_env_run_detected =
    hadApolloKeyBefore ||
    hadSupabaseBefore ||
    (isPresent(process.env.APOLLO_API_KEY) && loaded_files.length === 0) ||
    (isPresent(process.env.GROWTH_APOLLO_API_KEY) && loaded_files.length === 0)

  return {
    qa_marker: APOLLO_LIVE_PILOT_PRODUCTION_ENV_QA_MARKER,
    loaded_files,
    skipped_files,
    vercel_env_run_detected,
    recommended_command: APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND,
  }
}
