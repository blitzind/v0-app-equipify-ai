/** Client-safe Growth Engine relationship intelligence types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_RELATIONSHIP_TIERS = [
  "unknown",
  "developing",
  "active",
  "trusted",
  "strategic",
] as const
export type GrowthRelationshipTier = (typeof GROWTH_RELATIONSHIP_TIERS)[number]

export const GROWTH_RELATIONSHIP_TRENDS = ["improving", "stable", "cooling"] as const
export type GrowthRelationshipTrend = (typeof GROWTH_RELATIONSHIP_TRENDS)[number]

export const GROWTH_RELATIONSHIP_OWNER_ATTENTION_LEVELS = [
  "none",
  "recommended",
  "important",
  "critical",
] as const
export type GrowthRelationshipOwnerAttentionLevel =
  (typeof GROWTH_RELATIONSHIP_OWNER_ATTENTION_LEVELS)[number]

export const GROWTH_RELATIONSHIP_SIGNAL_KINDS = [
  "manual_touch",
  "connected_call",
  "positive_reply",
  "decision_maker_confirmed",
  "follow_up_completed",
  "multiple_touchpoints",
  "human_note_activity",
  "decision_maker_engagement",
  "call_duration",
  "meeting_scheduled",
  "unsubscribe",
  "not_interested",
  "long_silence",
  "multiple_failed_attempts",
  "bounce",
  "suppression",
] as const
export type GrowthRelationshipSignalKind = (typeof GROWTH_RELATIONSHIP_SIGNAL_KINDS)[number]

export const GROWTH_RELATIONSHIP_QUEUE_FILTERS = [
  "trusted_relationships",
  "strategic_relationships",
  "needs_relationship_building",
  "relationship_cooling",
] as const
export type GrowthRelationshipQueueFilter = (typeof GROWTH_RELATIONSHIP_QUEUE_FILTERS)[number]

export const GROWTH_RELATIONSHIP_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthRelationshipTrendWindow = (typeof GROWTH_RELATIONSHIP_TREND_WINDOWS)[number]

export type GrowthRelationshipSignal = {
  kind: GrowthRelationshipSignalKind
  occurredAt: string
  label: string
  isMeaningfulTouch?: boolean
}

export type GrowthRelationshipTopSignal = {
  kind: GrowthRelationshipSignalKind
  label: string
  points: number
  occurredAt: string
}

export type GrowthLeadRelationshipInput = {
  status: GrowthLeadStatus
  fit: number | null
  signals: GrowthRelationshipSignal[]
  isSuppressed: boolean
  previousScore: number | null
  previousTier: GrowthRelationshipTier | null
  previousTrend: GrowthRelationshipTrend | null
  engagementTier: import("@/lib/growth/engagement-types").GrowthEngagementTier | null
  now?: Date
}

export type GrowthLeadRelationshipResult = {
  score: number
  tier: GrowthRelationshipTier
  lastMeaningfulTouchAt: string | null
  summary: string
  topSignals: GrowthRelationshipTopSignal[]
  trend: GrowthRelationshipTrend
  ownerAttentionLevel: GrowthRelationshipOwnerAttentionLevel
}
