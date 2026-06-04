import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_CANONICAL_COMPANY_MIGRATION } from "@/lib/growth/canonical-companies/canonical-company-types"

export { GROWTH_CANONICAL_COMPANY_MIGRATION }

export async function isGrowthCanonicalCompanySchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("companies").select("id").limit(1)
  return !error
}
