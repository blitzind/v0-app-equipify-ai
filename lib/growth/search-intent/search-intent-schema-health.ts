import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SEARCH_INTENT_SCHEMA_SETUP_MESSAGE =
  "Search intent signals table is not ready. Apply migration 20270318120000_growth_engine_search_intent_signals.sql."

export async function isGrowthSearchIntentSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("search_intent_signals").select("id").limit(1)
  return !error
}
