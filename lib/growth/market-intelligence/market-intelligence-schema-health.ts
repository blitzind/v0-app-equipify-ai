import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_MARKET_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270406120000_growth_engine_market_graph_continuous_discovery.sql" as const

export async function isGrowthMarketIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("company_relationships").select("id").limit(1)
  return !error
}
