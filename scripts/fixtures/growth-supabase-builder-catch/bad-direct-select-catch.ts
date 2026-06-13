/** Fixture: must FAIL scan — builder-direct .catch() on select chain. */
import type { SupabaseClient } from "@supabase/supabase-js"

export function badDirectSelectCatch(admin: SupabaseClient) {
  return admin.from("leads").select("id").catch(() => ({ data: [], error: null }))
}
