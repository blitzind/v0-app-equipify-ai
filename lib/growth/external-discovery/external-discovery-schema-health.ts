import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_EXTERNAL_DISCOVERY_SCHEMA_MIGRATION =
  "20270322120000_growth_engine_external_company_discovery.sql" as const

export const GROWTH_EXTERNAL_DISCOVERY_SCHEMA_SETUP_MESSAGE = `External company discovery tables are not ready. Apply migration ${GROWTH_EXTERNAL_DISCOVERY_SCHEMA_MIGRATION}.`

export async function isGrowthExternalDiscoverySchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("external_company_discovery_runs")
    .select("id")
    .limit(1)
  return !error
}
