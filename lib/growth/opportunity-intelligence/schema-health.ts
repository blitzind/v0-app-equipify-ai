import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_OPPORTUNITY_INTELLIGENCE_SCHEMA_MIGRATION =
  "20270418120000_growth_opportunity_intelligence.sql" as const

export async function isGrowthOpportunityIntelligenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const checks = await Promise.all([
    admin.schema("growth").from("opportunity_signals").select("id").limit(1),
    admin.schema("growth").from("opportunity_recommendations").select("id").limit(1),
    admin.schema("growth").from("buying_committee_signals").select("id").limit(1),
    admin.schema("growth").from("crm_intelligence_events").select("id").limit(1),
    admin.schema("growth").from("sequence_pause_candidates").select("id").limit(1),
  ])
  return checks.every((result) => !result.error)
}
