/** GS-AI-PLAYBOOK-5B/5C — Unified operator activity view model (client-safe). */

export const GROWTH_ACTIVITY_CATEGORIES = [
  "communication",
  "personalization",
  "sales",
  "intelligence",
  "content",
] as const

export type GrowthActivityCategory = (typeof GROWTH_ACTIVITY_CATEGORIES)[number]

/** @deprecated Use `personalization` — kept for adapter migration tests. */
export type GrowthActivityLegacyAiCategory = "ai"

export const GROWTH_ACTIVITY_URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const

export type GrowthActivityUrgency = (typeof GROWTH_ACTIVITY_URGENCY_LEVELS)[number]

export type GrowthActivityQuickAction = {
  id: string
  label: string
  href: string
}

export type GrowthActivityEventMetadata = {
  sourceSystem?: string
  sourceRecordId?: string
  channel?: string | null
  sharePageId?: string | null
  landingPageId?: string | null
  generationId?: string | null
  opportunityId?: string | null
  isUnread?: boolean
  ownerUserId?: string | null
  signalType?: string | null
  rawEventType?: string | null
}

export type GrowthActivityEventView = {
  id: string
  type: string
  category: GrowthActivityCategory
  title: string
  description: string | null
  leadId: string | null
  leadName: string | null
  companyName: string | null
  occurredAt: string
  urgency: GrowthActivityUrgency
  score: number | null
  source: string
  landingPageId?: string | null
  landingPageTitle?: string | null
  actions: GrowthActivityQuickAction[]
  metadata: GrowthActivityEventMetadata
}

export type GrowthActivityRailQueueId =
  | "needs-attention"
  | "hot-prospects"
  | "meetings-ready"
  | "stalled-opportunities"

export type GrowthActivityRailCardView = {
  leadId: string
  name: string
  company: string | null
  score: number
  reason: string
  queueId: GrowthActivityRailQueueId
  lastActivityAt: string | null
  actions: GrowthActivityQuickAction[]
}

export type GrowthActivityRailQueues = Record<GrowthActivityRailQueueId, GrowthActivityRailCardView[]>

/** @deprecated Use GrowthActivityRailCardView — 5B compat alias. */
export type GrowthActivityHighIntentProspectView = GrowthActivityRailCardView

export type GrowthActivityMetricsView = {
  today: number
  thisWeek: number
  needsAttention: number
  highIntent: number
  meetingsBooked: number
  personalizationsGenerated: number
  callsCompleted: number
}

export type GrowthActivityFilterId =
  | "all"
  | "communication"
  | "personalization"
  | "sales"
  | "intelligence"
  | "content"
  | "needs-attention"
  | "high-intent"
  | "today"
  | "unread"
  | "my-leads"
  | "my-activity"
  | "this-week"
  | "needs-follow-up"
  | "ai-events"

export type GrowthActivitySourceAuditEntry = {
  source: string
  eventCount: number
  available: boolean
}
