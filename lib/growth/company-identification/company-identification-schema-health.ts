import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_COMPANY_IDENTIFICATION_SCHEMA_SETUP_MESSAGE =
  "Company identification matches table is not ready. Apply migration 20270319120000_growth_engine_company_identification_matches.sql."

export async function isGrowthCompanyIdentificationSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("company_identification_matches")
    .select("id")
    .limit(1)
  return !error
}
