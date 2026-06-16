/**
 * SN-2 — production/integration Supabase bootstrap for operator notification certification.
 * Prefers Vercel Production env injected by `vercel-production-env-run.ts` over local files.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
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

function sanitizeEnvValue(value: string | undefined): string {
  if (!value) return ""
  let trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed.replace(/\\+$/, "")
}

function isServiceRoleJwt(value: string): boolean {
  if (!value.startsWith("eyJ")) return false
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1]!, "base64url").toString()) as {
      role?: string
      iss?: string
    }
    return payload.role === "service_role" || String(payload.iss ?? "").includes("supabase")
  } catch {
    return false
  }
}

function resolveSupabaseUrlFromJwt(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as {
      ref?: string
    }
    if (payload.ref) return `https://${payload.ref}.supabase.co`
  } catch {
    return null
  }
  return null
}

function resolveSupabaseUrlFromEnv(env: Record<string, string | undefined>): string | null {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    const value = sanitizeEnvValue(env[key])
    if (value.startsWith("http")) return value
  }
  return null
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

  const processKey = sanitizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (isServiceRoleJwt(processKey)) {
    jwt = processKey
    envSource = vercelProductionEnvRun ? "vercel_production_process_env" : "process_env"
    url =
      resolveSupabaseUrlFromEnv(process.env) ??
      resolveSupabaseUrlFromJwt(processKey)
  }

  if (!jwt) {
    const boot = bootstrapGrowthProductionEnv({
      sources: GROWTH_OPERATOR_NOTIFICATIONS_PRODUCTION_ENV_SOURCES,
      inheritProcessEnv: true,
    })
    const mergedKey = sanitizeEnvValue(boot.found.SUPABASE_SERVICE_ROLE_KEY)
    if (isServiceRoleJwt(mergedKey)) {
      jwt = mergedKey
      envSource = boot.sources.SUPABASE_SERVICE_ROLE_KEY ?? "merged_env"
    }
    const mergedEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(boot.found)) {
      if (value) mergedEnv[key] = value
    }
    const { env: withAlias } = applySupabaseUrlPublicAlias(mergedEnv)
    url =
      resolveSupabaseUrlFromEnv(withAlias) ??
      (jwt ? resolveSupabaseUrlFromJwt(jwt) : null)
  }

  if (!jwt && vercelProductionEnvRun) {
    const projectRef = resolveLinkedSupabaseProjectRef()
    if (projectRef) {
      const cliKey = fetchSupabaseServiceRoleKeyFromCli(projectRef)
      if (cliKey && isServiceRoleJwt(cliKey)) {
        jwt = cliKey
        envSource = "supabase_cli_linked_project"
        url =
          url ??
          resolveSupabaseUrlFromEnv(process.env) ??
          resolveSupabaseUrlFromJwt(cliKey) ??
          resolveSupabaseUrlForProjectRef(projectRef)
      }
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
