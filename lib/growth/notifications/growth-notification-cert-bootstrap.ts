/**
 * SN-2 — production/integration Supabase bootstrap for operator notification certification.
 * Prefers Vercel Production env injected by `vercel-production-env-run.ts` over local files.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  isSupabaseServiceRoleJwt,
  resolveSupabaseCredentialsFromCliLinkedProject,
  resolveSupabaseUrlFromEnvRecord,
  resolveSupabaseUrlFromJwt,
  sanitizeSupabaseCertEnvValue,
} from "@/lib/growth/qa/growth-production-supabase-credential-resolution"
import {
  applySupabaseUrlPublicAlias,
  bootstrapGrowthProductionEnv,
} from "@/lib/growth/qa/reply-flow-env-bootstrap"

export const GROWTH_OPERATOR_NOTIFICATIONS_PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

export type GrowthOperatorNotificationsCertBootstrapResult = {
  url: string
  jwt: string
  admin: SupabaseClient
  env_source: string
  vercel_production_env_run: boolean
}

export function bootstrapGrowthOperatorNotificationsCertEnv(input?: {
  /** When true, only succeeds under `vercel-production-env-run.ts`. */
  requireVercelProductionEnvRun?: boolean
}): GrowthOperatorNotificationsCertBootstrapResult | null {
  const requireVercelProductionEnvRun = input?.requireVercelProductionEnvRun ?? false
  const vercelProductionEnvRun = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"

  if (requireVercelProductionEnvRun && !vercelProductionEnvRun) {
    return null
  }

  let jwt: string | null = null
  let url: string | null = null
  let envSource = ""

  const processKey = sanitizeSupabaseCertEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (isSupabaseServiceRoleJwt(processKey)) {
    jwt = processKey
    envSource = vercelProductionEnvRun ? "vercel_production_process_env" : "process_env"
    url = resolveSupabaseUrlFromEnvRecord(process.env) ?? resolveSupabaseUrlFromJwt(processKey)
  }

  if (!jwt) {
    const boot = bootstrapGrowthProductionEnv({
      sources: GROWTH_OPERATOR_NOTIFICATIONS_PRODUCTION_ENV_SOURCES,
      inheritProcessEnv: true,
    })
    const mergedKey = sanitizeSupabaseCertEnvValue(boot.found.SUPABASE_SERVICE_ROLE_KEY)
    if (isSupabaseServiceRoleJwt(mergedKey)) {
      jwt = mergedKey
      envSource = boot.sources.SUPABASE_SERVICE_ROLE_KEY ?? "merged_env"
    }
    const mergedEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(boot.found)) {
      if (value) mergedEnv[key] = value
    }
    const { env: withAlias } = applySupabaseUrlPublicAlias(mergedEnv)
    url =
      resolveSupabaseUrlFromEnvRecord(withAlias) ??
      (jwt ? resolveSupabaseUrlFromJwt(jwt) : null)
  }

  if (!jwt && vercelProductionEnvRun) {
    const cliResolution = resolveSupabaseCredentialsFromCliLinkedProject({
      existingUrl: url,
      env: process.env,
    })
    if (cliResolution) {
      jwt = cliResolution.jwt
      url = cliResolution.url
      envSource = cliResolution.env_source
    }
  }

  if (!jwt || !url?.startsWith("http")) return null

  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.SUPABASE_URL = url
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt

  return {
    url,
    jwt,
    admin: createClient(url, jwt, { auth: { persistSession: false } }),
    env_source: envSource,
    vercel_production_env_run: vercelProductionEnvRun,
  }
}
