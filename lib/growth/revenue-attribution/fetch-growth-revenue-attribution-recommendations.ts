import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAttributionRecommendations } from "@/lib/growth/revenue-attribution/attribution-recommendation-engine"
import {
  loadCtaCategorySignals,
  loadPainPointSignals,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-queries"
import type { GrowthRevenueAttributionRecommendationsPayload } from "@/lib/growth/revenue-attribution/attribution-recommendation-types"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"
import { fetchGrowthRevenueAttributionDashboard } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard"
import { listAttributionTouchesInRange } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-queries"
import type { GrowthRevenueAttributionDashboardFilters } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"
import { GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER } from "@/lib/growth/revenue-attribution/attribution-recommendation-types"

function emptyPayload(): GrowthRevenueAttributionRecommendationsPayload {
  const now = new Date().toISOString()
  return {
    qa_marker: GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER,
    recommendations: [],
    rollups: {
      personalization: { topPainPoints: [], topCtaCategories: [], note: "" },
      sequence: { topSequences: [], underperformingSequences: [] },
      channel: { topChannels: [], bottleneckStage: null, bottleneckConversionPct: null },
      sender: { topMailboxes: [], highVolumeZeroWinMailboxes: [] },
      industry: { topIndustries: [], weakIndustries: [] },
      generatedAt: now,
    },
    highConfidenceWins: [],
    underperformers: [],
    funnelBottlenecks: [],
    suggestedTests: [],
    lastCalculatedAt: now,
  }
}

export async function fetchGrowthRevenueAttributionRecommendations(
  admin: SupabaseClient,
  input?: Partial<GrowthRevenueAttributionDashboardFilters>,
): Promise<GrowthRevenueAttributionRecommendationsPayload> {
  if (!(await isGrowthAttributionTouchLedgerSchemaReady(admin))) {
    return emptyPayload()
  }

  const dashboard = await fetchGrowthRevenueAttributionDashboard(admin, input)
  const filters = dashboard.filters

  const touches = await listAttributionTouchesInRange(admin, filters)
  const wonTouches = touches.filter((t) => t.touchType === "opportunity_won")
  const wonLeadIds = [...new Set(wonTouches.map((t) => t.leadId))]

  const [ctaCategories, painPoints] = await Promise.all([
    loadCtaCategorySignals(admin, filters, wonLeadIds).catch(() => []),
    loadPainPointSignals(admin, wonTouches).catch(() => []),
  ])

  return generateAttributionRecommendations({
    funnel: dashboard.funnel,
    byChannel: dashboard.byChannel,
    bySequence: dashboard.bySequence,
    bySequenceStep: dashboard.bySequenceStep,
    byCampaign: dashboard.byCampaign,
    byRep: dashboard.byRep,
    bySenderMailbox: dashboard.bySenderMailbox,
    byIndustry: dashboard.byIndustry,
    byLeadSource: dashboard.byLeadSource,
    ctaCategories,
    painPoints,
    touchesAnalyzed: dashboard.touchesAnalyzed,
  })
}
