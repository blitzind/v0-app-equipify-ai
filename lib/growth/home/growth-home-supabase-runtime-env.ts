/**
 * GE-AVA-FRESH-SLATE-1C — Runtime Supabase / deployment env (safe for client + server).
 */

export function extractSupabaseProjectRef(url: string | null | undefined): string | null {
  if (!url?.trim()) return null
  try {
    const host = new URL(url.trim()).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export type GrowthHomeSupabaseRuntimeEnv = {
  supabase_url: string | null
  supabase_url_host: string | null
  supabase_project_ref: string | null
  growth_engine_ai_org_id: string | null
  vercel_env: string | null
  node_env: string | null
  git_sha: string | null
  vercel_deployment_id: string | null
  vercel_url: string | null
}

export function resolveGrowthHomeSupabaseRuntimeEnv(): GrowthHomeSupabaseRuntimeEnv {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    null

  let supabaseUrlHost: string | null = null
  if (supabaseUrl) {
    try {
      supabaseUrlHost = new URL(supabaseUrl).hostname
    } catch {
      supabaseUrlHost = null
    }
  }

  return {
    supabase_url: supabaseUrl,
    supabase_url_host: supabaseUrlHost,
    supabase_project_ref: extractSupabaseProjectRef(supabaseUrl),
    growth_engine_ai_org_id: process.env.GROWTH_ENGINE_AI_ORG_ID?.trim() || null,
    vercel_env: process.env.VERCEL_ENV?.trim() || null,
    node_env: process.env.NODE_ENV?.trim() || null,
    git_sha: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
    vercel_deployment_id: process.env.VERCEL_DEPLOYMENT_ID?.trim() || null,
    vercel_url: process.env.VERCEL_URL?.trim() || null,
  }
}

export function isGrowthHomeProductionRuntime(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production"
}
