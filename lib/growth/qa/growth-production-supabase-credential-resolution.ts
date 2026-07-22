/**
 * Shared Production Supabase credential resolution for certification bootstraps.
 * Used when Vercel Production env run cannot materialize encrypted secrets locally.
 */

import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"

export const GROWTH_PRODUCTION_SUPABASE_CREDENTIAL_RESOLUTION_QA_MARKER =
  "growth-production-supabase-credential-resolution-v1" as const

export function sanitizeSupabaseCertEnvValue(value: string | undefined): string {
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

export function isSupabaseServiceRoleJwt(value: string): boolean {
  const sanitized = sanitizeSupabaseCertEnvValue(value)
  if (!sanitized.startsWith("eyJ")) return false
  try {
    const payload = JSON.parse(Buffer.from(sanitized.split(".")[1]!, "base64url").toString()) as {
      role?: string
      iss?: string
    }
    return payload.role === "service_role" || String(payload.iss ?? "").includes("supabase")
  } catch {
    return false
  }
}

export function resolveSupabaseUrlFromJwt(jwt: string): string | null {
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

export function resolveSupabaseUrlFromEnvRecord(
  env: Record<string, string | undefined>,
): string | null {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]) {
    const value = sanitizeSupabaseCertEnvValue(env[key])
    if (value.startsWith("http")) return value
  }
  return null
}

export type GrowthProductionSupabaseCliCredentialResolution = {
  jwt: string
  url: string
  env_source: "supabase_cli_linked_project"
}

export function resolveSupabaseCredentialsFromCliLinkedProject(input?: {
  cwd?: string
  existingUrl?: string | null
  env?: Record<string, string | undefined>
  fetchServiceRoleKey?: (projectRef: string) => string | null
  resolveProjectRef?: (cwd?: string) => string | null
}): GrowthProductionSupabaseCliCredentialResolution | null {
  const projectRef = (input?.resolveProjectRef ?? resolveLinkedSupabaseProjectRef)(input?.cwd)
  if (!projectRef) return null

  const fetchServiceRoleKey = input?.fetchServiceRoleKey ?? fetchSupabaseServiceRoleKeyFromCli
  const cliKey = sanitizeSupabaseCertEnvValue(fetchServiceRoleKey(projectRef) ?? undefined)
  if (!isSupabaseServiceRoleJwt(cliKey)) return null

  const url =
    sanitizeSupabaseCertEnvValue(input?.existingUrl ?? undefined) ||
    resolveSupabaseUrlFromEnvRecord(input?.env ?? {}) ||
    resolveSupabaseUrlFromJwt(cliKey) ||
    resolveSupabaseUrlForProjectRef(projectRef)

  if (!url.startsWith("http")) return null

  return {
    jwt: cliKey,
    url,
    env_source: "supabase_cli_linked_project",
  }
}
