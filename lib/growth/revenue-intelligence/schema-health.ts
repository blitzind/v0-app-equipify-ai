import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SEQUENCE_REVENUE_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270417120000_growth_sequence_revenue_intelligence.sql" as const

export async function isGrowthRevenueSequenceIntelligenceSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("sequence_performance_snapshots").select("id").limit(1),
    admin.schema("growth").from("sender_performance_snapshots").select("id").limit(1),
    admin.schema("growth").from("provider_route_performance_snapshots").select("id").limit(1),
    admin.schema("growth").from("revenue_attribution_events").select("id").limit(1),
    admin.schema("growth").from("performance_intelligence_events").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
