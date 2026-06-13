/** Fixture: must FAIL scan — table(admin).update(...).eq(...).catch(). */
import type { SupabaseClient } from "@supabase/supabase-js"

function opportunitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunities")
}

export function badTableAdminUpdateCatch(admin: SupabaseClient) {
  return opportunitiesTable(admin)
    .update({ stage_key: "closed" })
    .eq("id", "opp-1")
    .catch(() => undefined)
}
