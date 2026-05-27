import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_DELIVERABILITY_OPS_SCHEMA_MIGRATION =
  "20270423120000_growth_deliverability_ops.sql" as const

export async function isGrowthDeliverabilityOpsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("deliverability_ops_snapshots").select("id").limit(1),
    admin.schema("growth").from("deliverability_recommendations").select("id").limit(1),
    admin.schema("growth").from("deliverability_risk_events").select("id").limit(1),
    admin.schema("growth").from("deliverability_remediation_tasks").select("id").limit(1),
    admin.schema("growth").from("deliverability_domain_reputation_history").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
