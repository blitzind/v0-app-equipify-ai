import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_COMPLIANCE_SCHEMA_MIGRATION = "20270410120000_growth_compliance_suppression.sql" as const

export async function isGrowthComplianceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("email_bounces").select("id").limit(1),
    admin.schema("growth").from("email_complaints").select("id").limit(1),
    admin.schema("growth").from("unsubscribe_registry").select("id").limit(1),
    admin.schema("growth").from("delivery_suppressions").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
