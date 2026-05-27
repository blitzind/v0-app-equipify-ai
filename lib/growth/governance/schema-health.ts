import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_ENTERPRISE_GOVERNANCE_SCHEMA_MIGRATION =
  "20270426120000_growth_enterprise_governance.sql" as const

export async function isGrowthEnterpriseGovernanceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("governance_policies").select("id").limit(1),
    admin.schema("growth").from("governance_policy_rules").select("id").limit(1),
    admin.schema("growth").from("governance_approval_audit").select("id").limit(1),
    admin.schema("growth").from("governance_activity_exports").select("id").limit(1),
    admin.schema("growth").from("governance_compliance_exports").select("id").limit(1),
    admin.schema("growth").from("governance_retention_policies").select("id").limit(1),
    admin.schema("growth").from("governance_policy_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
