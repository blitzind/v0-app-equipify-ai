import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_VERIFICATION_ENRICHMENT_SCHEMA_MIGRATION =
  "20270324120000_growth_engine_verification_enrichment.sql" as const

export const GROWTH_VERIFICATION_ENRICHMENT_SCHEMA_SETUP_MESSAGE = `Verification and enrichment tables are not ready. Apply migration ${GROWTH_VERIFICATION_ENRICHMENT_SCHEMA_MIGRATION}.`

export async function isGrowthVerificationEnrichmentSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("enrichment_runs")
    .select("id")
    .limit(1)
  return !error
}
