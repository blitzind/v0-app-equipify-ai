/** Fixture: must PASS scan — .then().catch() on builder chain. */
import type { SupabaseClient } from "@supabase/supabase-js"

export async function goodThenCatch(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("leads")
    .select("id")
    .then((result) => result)
    .catch(() => ({ data: [], error: null }))

  return { data, error }
}
