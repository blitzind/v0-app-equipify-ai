import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_DISCOVERY_ENGINE_SCHEMA_MIGRATION =
  "20270406120000_growth_engine_market_graph_continuous_discovery.sql" as const

export const GROWTH_DISCOVERY_ENGINE_SCHEMA_SETUP_MESSAGE = `Discovery engine tables are not ready. Apply migration ${GROWTH_DISCOVERY_ENGINE_SCHEMA_MIGRATION}.`

export async function isGrowthDiscoveryEngineSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("discovery_runs").select("id").limit(1)
  return !error
}
