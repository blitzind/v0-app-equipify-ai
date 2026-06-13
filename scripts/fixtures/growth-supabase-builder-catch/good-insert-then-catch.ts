/** Fixture: must PASS scan — fire-and-forget insert with .then().catch(). */
import type { SupabaseClient } from "@supabase/supabase-js"

export function goodInsertThenCatch(admin: SupabaseClient) {
  void admin
    .schema("growth")
    .from("timeline_events")
    .insert({ lead_id: "x", event_type: "test" })
    .then(() => undefined)
    .catch(() => undefined)
}
