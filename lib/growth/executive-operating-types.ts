/** Client-safe Growth Engine executive operating intelligence types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_EXECUTIVE_PRIORITY_TIERS = [
  "monitor",
  "important",
  "priority",
  "executive_now",
] as const
export type GrowthExecutivePriorityTier = (typeof GROWTH_EXECUTIVE_PRIORITY_TIERS)[number]

export const GROWTH_EXECUTIVE_INTERVENTION_AGE_BUCKETS = [
  "new",
  "active",
  "aging",
  "stalled",
] as const
export type GrowthExecutiveInterventionAgeBucket =
  (typeof GROWTH_EXECUTIVE_INTERVENTION_AGE_BUCKETS)[number]

export const GROWTH_EXECUTIVE_OPERATING_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthExecutiveOperatingTrendWindow =
  (typeof GROWTH_EXECUTIVE_OPERATING_TREND_WINDOWS)[number]

export const GROWTH_EXECUTIVE_OPERATING_QUEUE_FILTERS = [
  "executive_now",
  "executive_priority",
  "leadership_bottlenecks",
  "intelligence_conflicts",
] as const
export type GrowthExecutiveOperatingQueueFilter =
  (typeof GROWTH_EXECUTIVE_OPERATING_QUEUE_FILTERS)[number]

export type GrowthIntelligenceConflictSeverity = "warning" | "critical"

export type GrowthIntelligenceConflict = {
  key: string
  label: string
  severity: GrowthIntelligenceConflictSeverity
}

export type GrowthExecutiveOperatingTopSignal = {
  kind: string
  label: string
  points: number
}

export type GrowthLeadExecutiveOperatingInput = {
  status: GrowthLeadStatus
  fit: number | null
  assignedTo: string | null
  momentumTier: import("@/lib/growth/momentum-types").GrowthMomentumTier | null
  momentumScore: number | null
  workflowHealth: import("@/lib/growth/workflow-health-types").GrowthWorkflowHealthStatus | null
  engagementScore: number | null
  engagementTier: import("@/lib/growth/engagement-types").GrowthEngagementTier | null
  relationshipStrengthTier: import("@/lib/growth/relationship-types").GrowthRelationshipTier | null
  relationshipTrend: import("@/lib/growth/relationship-types").GrowthRelationshipTrend | null
  relationshipOwnerAttentionLevel: import("@/lib/growth/relationship-types").GrowthRelationshipOwnerAttentionLevel
  opportunityReadinessScore: number | null
  opportunityReadinessTier: import("@/lib/growth/opportunity-types").GrowthOpportunityReadinessTier | null
  opportunityBuyingSignalStrength: import("@/lib/growth/opportunity-types").GrowthOpportunityBuyingSignalStrength
  opportunityBlockerKeys: string[]
  revenueProbabilityScore: number | null
  revenueProbabilityTier: import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier | null
  revenueProbabilityConfidence: number
  revenueTrajectory: import("@/lib/growth/revenue-forecast-types").GrowthRevenueTrajectory
  revenueProbabilityPreviousScore: number | null
  revenueProbabilityVolatility: number
  forecastAttentionLevel: import("@/lib/growth/revenue-forecast-types").GrowthForecastAttentionLevel
  decisionMakerStatus: import("@/lib/growth/decision-maker-types").GrowthDecisionMakerPresenceStatus | null
  previousExecutiveScore: number | null
  previousExecutiveTier: GrowthExecutivePriorityTier | null
  previousConflictCount: number
  previousInterventionOpenedAt: string | null
  now?: Date
}

export type GrowthLeadExecutiveOperatingResult = {
  score: number
  tier: GrowthExecutivePriorityTier
  summary: string
  topSignals: GrowthExecutiveOperatingTopSignal[]
  volatility: number
  conflicts: GrowthIntelligenceConflict[]
  conflictSeverityScore: number
  recommendation: string
  owner: string | null
  interventionNeeded: boolean
  interventionOpenedAt: string | null
  interventionAgeBucket: GrowthExecutiveInterventionAgeBucket
}
