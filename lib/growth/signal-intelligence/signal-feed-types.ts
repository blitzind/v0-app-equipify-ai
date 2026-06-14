/** Phase GS-1D — Signal Feed types (client-safe). */

import type {
  LeadSignalSourceDomain,
  LeadSignalType,
  LeadSignalUrgency,
  SignalQueueHint,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export const SIGNAL_FEED_QA_MARKER = "growth-signal-feed-gs1d-v1" as const

export const SIGNAL_FEED_STATUSES = ["new", "viewed", "acted_on", "dismissed"] as const
export type SignalFeedStatus = (typeof SIGNAL_FEED_STATUSES)[number]

export const SIGNAL_FEED_FILTERS = [
  "new",
  "hot",
  "company",
  "engagement",
  "opportunity",
  "meeting",
  "external",
] as const
export type SignalFeedFilter = (typeof SIGNAL_FEED_FILTERS)[number]

export const SIGNAL_FEED_SORT_FIELDS = ["occurred_at", "confidence", "urgency"] as const
export type SignalFeedSortField = (typeof SIGNAL_FEED_SORT_FIELDS)[number]

export const SIGNAL_RECOMMENDATION_PRIORITIES = ["low", "medium", "high", "urgent"] as const
export type SignalRecommendationPriority = (typeof SIGNAL_RECOMMENDATION_PRIORITIES)[number]

export type SignalFeedRecommendation = {
  recommended_action: string
  reasoning: string
  expected_impact: string
  priority: SignalRecommendationPriority
  requires_human_approval: true
  queue_hint: SignalQueueHint | null
}

export type SignalFeedCtaLinks = {
  view_lead: string | null
  review_company: string | null
  open_timeline: string | null
  review_sequence: string | null
}

export type GrowthSignalFeedItem = {
  qa_marker: typeof SIGNAL_FEED_QA_MARKER
  id: string
  audit_event_id: string
  lead_id: string | null
  company_name: string | null
  signal_type: LeadSignalType | string
  signal_label: string
  source_domain: LeadSignalSourceDomain | string
  confidence: number
  urgency: LeadSignalUrgency | string
  signal_score: number | null
  occurred_at: string
  recommended_action: string
  expected_impact: string
  reasoning: string
  priority: SignalRecommendationPriority
  status: SignalFeedStatus
  dedupe_hash: string | null
  collapsed_count: number
  queue_hint: SignalQueueHint | null
  cta: SignalFeedCtaLinks
  requires_human_approval: true
}

export type GrowthSignalFeedResponse = {
  qa_marker: typeof SIGNAL_FEED_QA_MARKER
  generated_at: string
  total: number
  collapsed_from: number
  items: GrowthSignalFeedItem[]
  hot_signals: GrowthSignalFeedItem[]
}

export type SignalFeedActionType = "mark_viewed" | "mark_acted_on" | "dismiss"

export type SignalFeedActionRequest = {
  action: SignalFeedActionType
  audit_event_id: string
}

export const SIGNAL_FEED_EXECUTE_CONFIRM = "RUN_SIGNAL_FEED_CERTIFICATION" as const
