import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let cachedServiceRoleClient: SupabaseClient | null = null

/**
 * Server-only Supabase client using the service role key (bypasses RLS). Required for logo uploads and other writes
 * that must succeed regardless of row-level policies.
 *
 * Phase 8M — module singleton reused across requests in the same process (Vercel-safe).
 *
 * Env (Vercel / hosting): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
 * Without the service role key, `/api/organizations/.../workspace/logo` returns 503 with `service_unavailable`.
 */
export function createServiceRoleSupabaseClient(): SupabaseClient {
  if (cachedServiceRoleClient) return cachedServiceRoleClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  cachedServiceRoleClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedServiceRoleClient
}

export function resetServiceRoleSupabaseClientForTests(): void {
  cachedServiceRoleClient = null
}
