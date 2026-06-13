/** Fixture: must FAIL scan — multiline schema/from/select/limit then .catch(). */
import type { SupabaseClient } from "@supabase/supabase-js"

export function badMultilineSchemaCatch(admin: SupabaseClient) {
  return admin
    .schema("growth")
    .from("opportunities")
    .select("id")
    .limit(10)
    .catch(() => ({ data: [], error: null }))
}
