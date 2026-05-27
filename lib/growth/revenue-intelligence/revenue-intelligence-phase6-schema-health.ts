import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_REVENUE_INTELLIGENCE_PHASE6_MIGRATION =
  "20270602120000_growth_revenue_intelligence_v1.sql" as const

export const GROWTH_REVENUE_INTELLIGENCE_PHASE6_SETUP_MESSAGE =
  `Apply migration ${GROWTH_REVENUE_INTELLIGENCE_PHASE6_MIGRATION} for revenue intelligence Phase 6 tables.`

export async function probeRevenueIntelligencePhase6SchemaHealth(admin: SupabaseClient): Promise<{
  ok: boolean
  migration: typeof GROWTH_REVENUE_INTELLIGENCE_PHASE6_MIGRATION
  notes: string[]
}> {
  const notes: string[] = []
  const probes = await Promise.all([
    admin.schema("growth").from("buying_momentum_snapshots").select("id").limit(1),
    admin.schema("growth").from("buying_committee_maps").select("id").limit(1),
    admin.schema("growth").from("sales_execution_insight_snapshots").select("id").limit(1),
    admin.schema("growth").from("campaign_revenue_attribution_snapshots").select("id").limit(1),
    admin.schema("growth").from("opportunity_signal_timeline_events").select("id").limit(1),
  ])

  for (const probe of probes) {
    if (probe.error) notes.push(probe.error.message)
  }

  return {
    ok: notes.length === 0,
    migration: GROWTH_REVENUE_INTELLIGENCE_PHASE6_MIGRATION,
    notes: notes.length === 0 ? ["Revenue intelligence Phase 6 schema healthy."] : notes,
  }
}
