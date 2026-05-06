import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase client using the service role key (bypasses RLS). Required for logo uploads and other writes
 * that must succeed regardless of row-level policies.
 *
 * Env (Vercel / hosting): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
 * Without the service role key, `/api/organizations/.../workspace/logo` returns 503 with `service_unavailable`.
 */
export function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
