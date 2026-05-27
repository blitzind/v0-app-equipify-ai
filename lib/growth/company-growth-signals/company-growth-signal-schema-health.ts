import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_MIGRATION =
  "20270404120000_growth_engine_multi_source_growth_signals.sql" as const

export const GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_SETUP_MESSAGE = `Multi-source growth signal tables are not ready. Apply migration ${GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_MIGRATION}.`

export async function isGrowthCompanyGrowthSignalsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("company_growth_signals").select("id").limit(1)
  return !error
}
