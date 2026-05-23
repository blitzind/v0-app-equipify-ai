/** Client-safe Growth Engine revenue forecast types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_REVENUE_PROBABILITY_TIERS = [
  "unlikely",
  "possible",
  "probable",
  "forecasted",
  "commit_candidate",
] as const
export type GrowthRevenueProbabilityTier = (typeof GROWTH_REVENUE_PROBABILITY_TIERS)[number]

export const GROWTH_REVENUE_TRAJECTORIES = ["accelerating", "steady", "slowing", "at_risk"] as const
export type GrowthRevenueTrajectory = (typeof GROWTH_REVENUE_TRAJECTORIES)[number]

export const GROWTH_FORECAST_ATTENTION_LEVELS = ["none", "monitor", "important", "critical"] as const
export type GrowthForecastAttentionLevel = (typeof GROWTH_FORECAST_ATTENTION_LEVELS)[number]

export const GROWTH_REVENUE_FORECAST_QUEUE_FILTERS = [
  "commit_candidates",
  "forecasted",
  "probable",
  "low_confidence_forecast",
] as const
export type GrowthRevenueForecastQueueFilter = (typeof GROWTH_REVENUE_FORECAST_QUEUE_FILTERS)[number]

export const GROWTH_REVENUE_FORECAST_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthRevenueForecastTrendWindow = (typeof GROWTH_REVENUE_FORECAST_TREND_WINDOWS)[number]

export const CRITICAL_REVENUE_BLOCKER_KEYS = new Set([
  "suppressed",
  "not_interested",
])

export type GrowthRevenueForecastTopSignal = {
  kind: string
  label: string
  points: number
}

export type GrowthLeadRevenueForecastInput = {
  status: GrowthLeadStatus
  fit: number | null
  decisionMakerStatus: import("@/lib/growth/decision-maker-types").GrowthDecisionMakerPresenceStatus | null
  workflowHealth: import("@/lib/growth/workflow-health-types").GrowthWorkflowHealthStatus | null
  momentumTier: import("@/lib/growth/momentum-types").GrowthMomentumTier | null
  engagementScore: number | null
  engagementTier: import("@/lib/growth/engagement-types").GrowthEngagementTier | null
  relationshipStrengthScore: number | null
  relationshipStrengthTier: import("@/lib/growth/relationship-types").GrowthRelationshipTier | null
  relationshipTrend: import("@/lib/growth/relationship-types").GrowthRelationshipTrend | null
  opportunityReadinessScore: number | null
  opportunityReadinessTier: import("@/lib/growth/opportunity-types").GrowthOpportunityReadinessTier | null
  opportunityReadinessConfidence: number
  opportunityReadinessTrend: import("@/lib/growth/opportunity-types").GrowthOpportunityReadinessTrend | null
  opportunityBuyingSignalStrength: import("@/lib/growth/opportunity-types").GrowthOpportunityBuyingSignalStrength
  opportunityBlockerKeys: string[]
  opportunityAcceleratorCount: number
  hasPositiveReply: boolean
  connectedCallCount: number
  hasUsableResearch: boolean
  researchConfidence: number | null
  engagementComputedAt: string | null
  relationshipComputedAt: string | null
  opportunityReadinessComputedAt: string | null
  previousScore: number | null
  previousTier: GrowthRevenueProbabilityTier | null
  previousConfidence: number | null
  now?: Date
}

export type GrowthLeadRevenueForecastResult = {
  score: number
  tier: GrowthRevenueProbabilityTier
  summary: string
  topSignals: GrowthRevenueForecastTopSignal[]
  confidence: number
  trajectory: GrowthRevenueTrajectory
  volatility: number
  contributionWeight: number
  attentionLevel: GrowthForecastAttentionLevel
}
