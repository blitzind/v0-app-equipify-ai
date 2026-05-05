import "server-only"

import { createClient } from "@supabase/supabase-js"

/** Service-role client for server-side writes RLS blocks for authenticated users (e.g. organization_subscriptions). */
export function createServiceRoleSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
