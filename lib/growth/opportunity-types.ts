/** Client-safe Growth Engine opportunity readiness types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_OPPORTUNITY_READINESS_TIERS = [
  "not_ready",
  "developing",
  "qualified",
  "sales_ready",
  "priority_opportunity",
] as const
export type GrowthOpportunityReadinessTier = (typeof GROWTH_OPPORTUNITY_READINESS_TIERS)[number]

export const GROWTH_OPPORTUNITY_READINESS_TRENDS = ["improving", "stable", "declining"] as const
export type GrowthOpportunityReadinessTrend = (typeof GROWTH_OPPORTUNITY_READINESS_TRENDS)[number]

export const GROWTH_OPPORTUNITY_BUYING_SIGNAL_STRENGTHS = ["none", "weak", "moderate", "strong"] as const
export type GrowthOpportunityBuyingSignalStrength =
  (typeof GROWTH_OPPORTUNITY_BUYING_SIGNAL_STRENGTHS)[number]

export const GROWTH_OPPORTUNITY_AGE_BUCKETS = ["new", "developing", "maturing", "stalled"] as const
export type GrowthOpportunityAgeBucket = (typeof GROWTH_OPPORTUNITY_AGE_BUCKETS)[number]

export const GROWTH_OPPORTUNITY_BLOCKER_KEYS = [
  "missing_decision_maker",
  "low_engagement",
  "relationship_cooling",
  "no_phone",
  "insufficient_research",
  "missing_website",
  "suppressed",
  "not_interested",
  "long_inactivity",
  "multiple_failed_attempts",
] as const
export type GrowthOpportunityBlockerKey = (typeof GROWTH_OPPORTUNITY_BLOCKER_KEYS)[number]

export const GROWTH_OPPORTUNITY_ACCELERATOR_KEYS = [
  "positive_reply",
  "trusted_relationship",
  "connected_call",
  "decision_maker_confirmed",
  "hot_engagement",
  "high_fit",
  "strategic_relationship",
  "multiple_meaningful_touches",
  "research_confidence",
] as const
export type GrowthOpportunityAcceleratorKey = (typeof GROWTH_OPPORTUNITY_ACCELERATOR_KEYS)[number]

export const GROWTH_OPPORTUNITY_QUEUE_FILTERS = [
  "priority_opportunities",
  "sales_ready",
  "needs_qualification",
  "blocked_opportunities",
] as const
export type GrowthOpportunityQueueFilter = (typeof GROWTH_OPPORTUNITY_QUEUE_FILTERS)[number]

export const GROWTH_OPPORTUNITY_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthOpportunityTrendWindow = (typeof GROWTH_OPPORTUNITY_TREND_WINDOWS)[number]

export const CRITICAL_OPPORTUNITY_BLOCKER_KEYS = new Set<GrowthOpportunityBlockerKey>([
  "suppressed",
  "not_interested",
])

export type GrowthOpportunityBlocker = {
  key: GrowthOpportunityBlockerKey
  label: string
}

export type GrowthOpportunityAccelerator = {
  key: GrowthOpportunityAcceleratorKey
  label: string
}

export type GrowthOpportunityTopSignal = {
  kind: string
  label: string
  points: number
}

export type GrowthLeadOpportunityReadinessInput = {
  status: GrowthLeadStatus
  fit: number | null
  website: string | null
  contactPhone: string | null
  primaryDecisionMakerPhone: string | null
  lastResearchedAt: string | null
  latestResearchRunId: string | null
  researchConfidence: number | null
  hasUsableResearch: boolean
  decisionMakerStatus: import("@/lib/growth/decision-maker-types").GrowthDecisionMakerPresenceStatus | null
  engagementTier: import("@/lib/growth/engagement-types").GrowthEngagementTier | null
  engagementScore: number | null
  engagementLastActivityAt: string | null
  relationshipStrengthTier: import("@/lib/growth/relationship-types").GrowthRelationshipTier | null
  relationshipStrengthScore: number | null
  relationshipTrend: import("@/lib/growth/relationship-types").GrowthRelationshipTrend | null
  relationshipLastMeaningfulTouchAt: string | null
  lastHumanTouchAt: string | null
  connectedCallCount: number
  callAttemptCount: number
  voicemailCount: number
  isSuppressed: boolean
  hasPositiveReply: boolean
  hasNotInterestedReply: boolean
  createdAt: string
  previousScore: number | null
  previousTrend: GrowthOpportunityReadinessTrend | null
  now?: Date
}

export type GrowthLeadOpportunityReadinessResult = {
  score: number
  tier: GrowthOpportunityReadinessTier
  summary: string
  topSignals: GrowthOpportunityTopSignal[]
  blockers: GrowthOpportunityBlocker[]
  accelerators: GrowthOpportunityAccelerator[]
  trend: GrowthOpportunityReadinessTrend
  buyingSignalStrength: GrowthOpportunityBuyingSignalStrength
  confidence: number
  ageBucket: GrowthOpportunityAgeBucket
}
