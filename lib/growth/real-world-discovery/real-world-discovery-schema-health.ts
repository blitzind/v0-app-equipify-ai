import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_REAL_WORLD_DISCOVERY_SCHEMA_MIGRATION =
  "20270325120000_growth_engine_real_world_company_discovery.sql" as const

export const GROWTH_REAL_WORLD_DISCOVERY_SCHEMA_SETUP_MESSAGE = `Real-world company discovery tables are not ready. Apply migration ${GROWTH_REAL_WORLD_DISCOVERY_SCHEMA_MIGRATION}.`

export async function isGrowthRealWorldDiscoverySchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("id")
    .limit(1)
  return !error
}
