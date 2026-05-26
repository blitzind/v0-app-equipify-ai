import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE =
  "Prospect Search tables are not ready. Apply migration 20270321120000_growth_engine_prospect_search.sql."

export async function isGrowthProspectSearchSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("id")
    .limit(1)
  return !error
}
