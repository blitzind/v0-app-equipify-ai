import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_COMPANY_SIGNAL_SCHEMA_MIGRATION =
  "20270327120000_growth_engine_company_signal_intelligence.sql" as const

export const GROWTH_COMPANY_SIGNAL_SCHEMA_SETUP_MESSAGE = `Company signal intelligence tables are not ready. Apply migration ${GROWTH_COMPANY_SIGNAL_SCHEMA_MIGRATION}.`

export async function isGrowthCompanySignalSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("company_signal_runs")
    .select("id")
    .limit(1)
  return !error
}
