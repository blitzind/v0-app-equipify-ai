/** Client-safe Growth Engine engagement intelligence types. */

import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_ENGAGEMENT_TIERS = ["cold", "warming", "engaged", "hot"] as const
export type GrowthEngagementTier = (typeof GROWTH_ENGAGEMENT_TIERS)[number]

export const GROWTH_ENGAGEMENT_SIGNAL_KINDS = [
  "email_open",
  "email_click",
  "email_reply",
  "positive_reply",
  "call_connected",
  "manual_touch",
  "follow_up_completed",
  "decision_maker_confirmed",
  "research_completed",
  "unsubscribe",
  "not_interested",
  "bounce",
  "suppression",
  "share_page_view",
  "share_page_engaged",
  "share_page_cta_click",
  "share_page_booking_completed",
] as const
export type GrowthEngagementSignalKind = (typeof GROWTH_ENGAGEMENT_SIGNAL_KINDS)[number]

export const GROWTH_ENGAGEMENT_QUEUE_FILTERS = [
  "hot",
  "engaged",
  "dormant",
  "recently_active",
  "decision_maker_engaged",
] as const
export type GrowthEngagementQueueFilter = (typeof GROWTH_ENGAGEMENT_QUEUE_FILTERS)[number]

export const GROWTH_ENGAGEMENT_TREND_WINDOWS = ["7d", "30d", "90d"] as const
export type GrowthEngagementTrendWindow = (typeof GROWTH_ENGAGEMENT_TREND_WINDOWS)[number]

export type GrowthEngagementSignal = {
  kind: GrowthEngagementSignalKind
  occurredAt: string
  label: string
}

export type GrowthEngagementTopSignal = {
  kind: GrowthEngagementSignalKind
  label: string
  decayedPoints: number
  occurredAt: string
}

export type GrowthLeadEngagementInput = {
  status: GrowthLeadStatus
  signals: GrowthEngagementSignal[]
  isSuppressed: boolean
  dormancyExemptUntil: string | null
  now?: Date
}

export type GrowthLeadEngagementResult = {
  score: number
  tier: GrowthEngagementTier
  lastActivityAt: string | null
  summary: string
  topSignals: GrowthEngagementTopSignal[]
  isDormant: boolean
}

export type GrowthLeadActivityStreamItem = {
  id: string
  kind: string
  title: string
  summary: string | null
  occurredAt: string
  source: "timeline" | "email" | "call" | "reply"
}
