import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_COMPANY_CONTACTS_SCHEMA_MIGRATION =
  "20270403120000_growth_engine_company_contacts.sql" as const

export const GROWTH_COMPANY_CONTACTS_SCHEMA_SETUP_MESSAGE = `Company contacts tables are not ready. Apply migration ${GROWTH_COMPANY_CONTACTS_SCHEMA_MIGRATION}.`

export async function isGrowthCompanyContactsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("company_contacts").select("id").limit(1)
  return !error
}
