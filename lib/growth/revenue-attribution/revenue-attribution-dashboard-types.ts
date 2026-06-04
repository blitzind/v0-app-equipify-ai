/** Phase 6.32B-2 — Unified revenue attribution dashboard (client-safe). */

import type { GrowthAttributionTouchType } from "@/lib/growth/revenue-attribution/attribution-touch-types"

export const GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER =
  "growth-revenue-attribution-dashboard-v1" as const

export const GROWTH_ATTRIBUTION_MODELS = ["first_touch", "last_touch"] as const
export type GrowthAttributionModel = (typeof GROWTH_ATTRIBUTION_MODELS)[number]

export type GrowthRevenueAttributionDashboardFilters = {
  dateFrom: string
  dateTo: string
  channel: string | null
  repUserId: string | null
  sequenceId: string | null
  attributionModel: GrowthAttributionModel
}

export type GrowthAttributionDimensionRow = {
  key: string
  label: string
  touchCount: number
  leadCount: number
  opportunities: number
  wins: number
  attributedRevenue: number
}

export type GrowthAttributionFunnelStep = {
  stage: "lead" | "reply" | "meeting" | "opportunity" | "closed_won"
  label: string
  count: number
  conversionRatePct: number | null
  revenue: number
}

export type GrowthAttributionRevenueSummary = {
  pipelineRevenue: number
  closedWonRevenue: number
  attributedRevenue: number
  averageDealSize: number
  winRatePct: number
  opportunityCount: number
  winCount: number
}

export type GrowthRevenueAttributionDashboard = {
  qa_marker: typeof GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER
  filters: GrowthRevenueAttributionDashboardFilters
  attributionModel: GrowthAttributionModel
  revenue: GrowthAttributionRevenueSummary
  funnel: GrowthAttributionFunnelStep[]
  byCampaign: GrowthAttributionDimensionRow[]
  bySequence: GrowthAttributionDimensionRow[]
  bySequenceStep: GrowthAttributionDimensionRow[]
  byChannel: GrowthAttributionDimensionRow[]
  byRep: GrowthAttributionDimensionRow[]
  bySenderMailbox: GrowthAttributionDimensionRow[]
  byIndustry: GrowthAttributionDimensionRow[]
  byLeadSource: GrowthAttributionDimensionRow[]
  topPerformers: {
    campaigns: GrowthAttributionDimensionRow[]
    sequences: GrowthAttributionDimensionRow[]
    reps: GrowthAttributionDimensionRow[]
    senderMailboxes: GrowthAttributionDimensionRow[]
    industries: GrowthAttributionDimensionRow[]
    leadSources: GrowthAttributionDimensionRow[]
  }
  touchVolumeByType: Array<{ touchType: GrowthAttributionTouchType; count: number }>
  pathsIndexed: number
  touchesAnalyzed: number
  lastCalculatedAt: string
}

export function attributionModelLabel(model: GrowthAttributionModel): string {
  return model === "first_touch" ? "First touch" : "Last touch"
}
