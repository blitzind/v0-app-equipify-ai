/** Phase 6.32B-3 — Closed-loop attribution recommendations (client-safe). */

import type { GrowthAttributionDimensionRow, GrowthAttributionFunnelStep } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

export const GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER =
  "growth-revenue-attribution-recommendations-v1" as const

export const GROWTH_ATTRIBUTION_RECOMMENDATION_TYPES = [
  "double_down",
  "reduce_volume",
  "improve_copy",
  "improve_targeting",
  "improve_follow_up",
  "investigate",
  "pause_candidate",
] as const

export type GrowthAttributionRecommendationType = (typeof GROWTH_ATTRIBUTION_RECOMMENDATION_TYPES)[number]

export const GROWTH_ATTRIBUTION_IMPACTED_DIMENSIONS = [
  "channel",
  "sequence",
  "sequence_step",
  "campaign",
  "cta",
  "pain_point",
  "industry",
  "lead_source",
  "sender_mailbox",
  "rep",
  "funnel",
] as const

export type GrowthAttributionImpactedDimension = (typeof GROWTH_ATTRIBUTION_IMPACTED_DIMENSIONS)[number]

export type GrowthAttributionRecommendationEvidence = {
  label: string
  value: string
  metric?: string
}

export type GrowthAttributionRecommendation = {
  id: string
  recommendationType: GrowthAttributionRecommendationType
  title: string
  explanation: string
  evidence: GrowthAttributionRecommendationEvidence[]
  confidence: number
  impactedDimension: GrowthAttributionImpactedDimension
  dimensionKey: string
  dimensionLabel: string
  recommendedAction: string
  safetyNotes: string
  category: "high_confidence_win" | "underperformer" | "funnel_bottleneck" | "suggested_test"
}

export type GrowthAttributionPersonalizationInsightRollup = {
  topPainPoints: Array<{ key: string; label: string; winCount: number; leadCount: number }>
  topCtaCategories: Array<{ key: string; label: string; sendCount: number; positiveReplyRatePct: number | null }>
  note: string
}

export type GrowthAttributionSequenceInsightRollup = {
  topSequences: Array<{ key: string; label: string; attributedRevenue: number; wins: number }>
  underperformingSequences: Array<{ key: string; label: string; touchCount: number; wins: number }>
}

export type GrowthAttributionChannelInsightRollup = {
  topChannels: Array<{ key: string; label: string; attributedRevenue: number; wins: number }>
  bottleneckStage: string | null
  bottleneckConversionPct: number | null
}

export type GrowthAttributionSenderInsightRollup = {
  topMailboxes: Array<{ key: string; label: string; attributedRevenue: number; wins: number }>
  highVolumeZeroWinMailboxes: Array<{ key: string; label: string; touchCount: number }>
}

export type GrowthAttributionIndustryInsightRollup = {
  topIndustries: Array<{ key: string; label: string; attributedRevenue: number; wins: number }>
  weakIndustries: Array<{ key: string; label: string; leadCount: number; wins: number }>
}

export type GrowthAttributionClosedLoopRollups = {
  personalization: GrowthAttributionPersonalizationInsightRollup
  sequence: GrowthAttributionSequenceInsightRollup
  channel: GrowthAttributionChannelInsightRollup
  sender: GrowthAttributionSenderInsightRollup
  industry: GrowthAttributionIndustryInsightRollup
  generatedAt: string
}

export type GrowthRevenueAttributionRecommendationsPayload = {
  qa_marker: typeof GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER
  attributionModel: import("@/lib/growth/revenue-attribution/attribution-credit-model").GrowthAttributionModel
  recommendations: GrowthAttributionRecommendation[]
  rollups: GrowthAttributionClosedLoopRollups
  highConfidenceWins: GrowthAttributionRecommendation[]
  underperformers: GrowthAttributionRecommendation[]
  funnelBottlenecks: GrowthAttributionRecommendation[]
  suggestedTests: GrowthAttributionRecommendation[]
  lastCalculatedAt: string
}

export const GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES =
  "Advisory only. Operators must approve changes. No automatic sequence edits, personalization, sender routing, or sends."

export type AttributionRecommendationEngineInput = {
  attributionModel?: import("@/lib/growth/revenue-attribution/attribution-credit-model").GrowthAttributionModel
  funnel: GrowthAttributionFunnelStep[]
  byChannel: GrowthAttributionDimensionRow[]
  bySequence: GrowthAttributionDimensionRow[]
  bySequenceStep: GrowthAttributionDimensionRow[]
  byCampaign: GrowthAttributionDimensionRow[]
  byRep: GrowthAttributionDimensionRow[]
  bySenderMailbox: GrowthAttributionDimensionRow[]
  byIndustry: GrowthAttributionDimensionRow[]
  byLeadSource: GrowthAttributionDimensionRow[]
  ctaCategories?: Array<{ key: string; label: string; sendCount: number; wins: number; positiveReplies: number }>
  painPoints?: Array<{ key: string; label: string; winCount: number; leadCount: number }>
  touchesAnalyzed: number
}

export function recommendationTypeLabel(type: GrowthAttributionRecommendationType): string {
  switch (type) {
    case "double_down":
      return "Double down"
    case "reduce_volume":
      return "Reduce volume"
    case "improve_copy":
      return "Improve copy"
    case "improve_targeting":
      return "Improve targeting"
    case "improve_follow_up":
      return "Improve follow-up"
    case "investigate":
      return "Investigate"
    case "pause_candidate":
      return "Pause candidate"
    default:
      return type
  }
}
