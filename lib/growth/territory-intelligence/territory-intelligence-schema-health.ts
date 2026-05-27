import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270405120000_growth_engine_territory_intelligence.sql" as const

export const GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_SETUP_MESSAGE = `Territory intelligence tables are not ready. Apply migration ${GROWTH_TERRITORY_INTELLIGENCE_SCHEMA_MIGRATION}.`

export async function isGrowthTerritoryIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("territories").select("id").limit(1)
  return !error
}
