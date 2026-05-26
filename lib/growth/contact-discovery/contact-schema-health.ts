import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION =
  "20270323120000_growth_engine_contact_discovery.sql" as const

export const GROWTH_CONTACT_DISCOVERY_SCHEMA_SETUP_MESSAGE = `Contact discovery tables are not ready. Apply migration ${GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION}.`

export async function isGrowthContactDiscoverySchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("contact_discovery_runs")
    .select("id")
    .limit(1)
  return !error
}
