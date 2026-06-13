/** Fixture: must FAIL scan — builder-direct .catch() on maybeSingle chain. */
import type { SupabaseClient } from "@supabase/supabase-js"

export function badDirectMaybeSingleCatch(admin: SupabaseClient) {
  return admin.from("leads").select("id").eq("id", "x").maybeSingle().catch(() => ({ data: null, error: null }))
}
