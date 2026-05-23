/** Client-safe Growth Engine operational capacity types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_OPERATIONAL_CAPACITY_TIERS = [
  "healthy",
  "strained",
  "constrained",
  "critical",
] as const
export type GrowthOperationalCapacityTier = (typeof GROWTH_OPERATIONAL_CAPACITY_TIERS)[number]

export const GROWTH_CONSTRAINT_AGE_BUCKETS = ["new", "active", "aging", "stalled"] as const
export type GrowthConstraintAgeBucket = (typeof GROWTH_CONSTRAINT_AGE_BUCKETS)[number]

export const GROWTH_CAPACITY_RECOVERY_DIRECTIONS = ["recovering", "stable", "worsening"] as const
export type GrowthCapacityRecoveryDirection = (typeof GROWTH_CAPACITY_RECOVERY_DIRECTIONS)[number]

export const GROWTH_OPERATIONAL_CAPACITY_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthOperationalCapacityTrendWindow =
  (typeof GROWTH_OPERATIONAL_CAPACITY_TREND_WINDOWS)[number]

export const GROWTH_OPERATIONAL_CAPACITY_QUEUE_FILTERS = [
  "capacity_risk",
  "executive_overload",
  "protected_opportunities",
  "constraint_pressure",
] as const
export type GrowthOperationalCapacityQueueFilter =
  (typeof GROWTH_OPERATIONAL_CAPACITY_QUEUE_FILTERS)[number]

export type GrowthOperationalConstraintSeverity = "warning" | "critical"

export type GrowthOperationalConstraint = {
  key: string
  label: string
  severity: GrowthOperationalConstraintSeverity
}

export type GrowthCapacityConflict = {
  key: string
  label: string
  severity: GrowthOperationalConstraintSeverity
}

export type GrowthOperationalCapacityTopConstraint = {
  kind: string
  label: string
  pressure: number
}

export type GrowthOperationalCapacityPlatformSnapshot = {
  executiveNowCount: number
  executivePriorityCount: number
  openFollowUpCount: number
  callQueueLoadCount: number
  interventionBacklogCount: number
  interventionAgingCount: number
  interventionStalledCount: number
  priorityOpportunityCount: number
  leadershipBottleneckCount: number
  stalledOpportunityCount: number
  forecastAttentionCount: number
  hotOpportunityCount: number
  manualTouchBacklogCount: number
  decisionMakerBacklogCount: number
  protectedPipelineCount: number
  protectedPipelineHealthyCount: number
  assignedWorkOrders: number
  assignedTechnicians: number
  dispatchPressure: number
  supportQueuePressure: number
}

export type GrowthLeadOperationalCapacityInput = {
  status: GrowthLeadStatus
  fit: number | null
  followUpAt: string | null
  callPriorityTier: import("@/lib/growth/call-types").GrowthCallPriorityTier | null
  lastHumanTouchAt: string | null
  nextBestAction: import("@/lib/growth/nba-types").GrowthNextBestAction | null
  engagementTier: import("@/lib/growth/engagement-types").GrowthEngagementTier | null
  engagementLastActivityAt: string | null
  opportunityReadinessTier: import("@/lib/growth/opportunity-types").GrowthOpportunityReadinessTier | null
  opportunityAgeBucket: import("@/lib/growth/opportunity-types").GrowthOpportunityAgeBucket
  opportunityBlockerKeys: string[]
  workflowHealth: import("@/lib/growth/workflow-health-types").GrowthWorkflowHealthStatus | null
  revenueProbabilityTier: import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier | null
  forecastAttentionLevel: import("@/lib/growth/revenue-forecast-types").GrowthForecastAttentionLevel
  executivePriorityTier: import("@/lib/growth/executive-operating-types").GrowthExecutivePriorityTier | null
  executiveInterventionAgeBucket: import("@/lib/growth/executive-operating-types").GrowthExecutiveInterventionAgeBucket
  relationshipOwnerAttentionLevel: import("@/lib/growth/relationship-types").GrowthRelationshipOwnerAttentionLevel
  intelligenceConflictSeverityScore: number
  decisionMakerStatus: import("@/lib/growth/decision-maker-types").GrowthDecisionMakerPresenceStatus | null
  opportunityBuyingSignalStrength: import("@/lib/growth/opportunity-types").GrowthOpportunityBuyingSignalStrength
  relationshipStrengthTier: import("@/lib/growth/relationship-types").GrowthRelationshipTier | null
  snapshot: GrowthOperationalCapacityPlatformSnapshot
  previousCapacityScore: number | null
  previousPressureLevel: number | null
  previousCapacityTier: GrowthOperationalCapacityTier | null
  previousConstraintKeys: string[]
  previousConstraintOpenedAt: string | null
  previousConstraintCount: number
  now?: Date
}

export type GrowthLeadOperationalCapacityResult = {
  score: number
  tier: GrowthOperationalCapacityTier
  summary: string
  topConstraints: GrowthOperationalCapacityTopConstraint[]
  pressureLevel: number
  pressureVolatility: number
  protectedPipelineCoverage: number
  constraints: GrowthOperationalConstraint[]
  conflicts: GrowthCapacityConflict[]
  protectionRecommendation: string
  constraintOpenedAt: string | null
  constraintAgeBucket: GrowthConstraintAgeBucket
  recoveryDirection: GrowthCapacityRecoveryDirection
  isProtectedOpportunity: boolean
}

export function diffOperationalConstraintKeys(
  previous: Array<{ key: string }>,
  current: Array<{ key: string }>,
): { added: string[]; resolved: string[] } {
  const prevKeys = new Set(previous.map((entry) => entry.key))
  const nextKeys = new Set(current.map((entry) => entry.key))
  return {
    added: [...nextKeys].filter((key) => !prevKeys.has(key)),
    resolved: [...prevKeys].filter((key) => !nextKeys.has(key)),
  }
}
