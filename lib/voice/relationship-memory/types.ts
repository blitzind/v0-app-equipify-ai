/** Voice relationship memory — Phase 2C shared types (client-safe). */

export const VOICE_RELATIONSHIP_MEMORY_QA_MARKER = "voice-relationship-memory-v1" as const

export const VOICE_RELATIONSHIP_MEMORY_PASSIVE_MODE_ENABLED = true as const
export const VOICE_RELATIONSHIP_MEMORY_AUTONOMOUS_ACTIONS_DISABLED = true as const

export const VOICE_RELATIONSHIP_MEMORY_TYPES = [
  "pricing_objection",
  "competitor_mention",
  "callback_preference",
  "preferred_channel",
  "decision_maker",
  "budget_concern",
  "urgency_signal",
  "cancellation_risk",
  "follow_up_request",
  "scheduling_preference",
  "escalation_pattern",
  "positive_sentiment",
  "negative_sentiment",
  "booking_interest",
] as const

export type VoiceRelationshipMemoryType = (typeof VOICE_RELATIONSHIP_MEMORY_TYPES)[number]

export const VOICE_RELATIONSHIP_STATUSES = [
  "new",
  "active",
  "nurturing",
  "at_risk",
  "escalated",
  "dormant",
] as const

export type VoiceRelationshipStatus = (typeof VOICE_RELATIONSHIP_STATUSES)[number]

export const VOICE_RELATIONSHIP_SENTIMENT_TRENDS = [
  "unknown",
  "improving",
  "stable",
  "declining",
  "volatile",
] as const

export type VoiceRelationshipSentimentTrend = (typeof VOICE_RELATIONSHIP_SENTIMENT_TRENDS)[number]

export const VOICE_RELATIONSHIP_MEMORY_EVENT_STATUSES = [
  "active",
  "superseded",
  "expired",
  "merged",
] as const

export type VoiceRelationshipMemoryEventStatus = (typeof VOICE_RELATIONSHIP_MEMORY_EVENT_STATUSES)[number]

export const VOICE_RELATIONSHIP_MEMORY_DRAFT_ACTIONS = [
  "accept",
  "reject",
  "merge",
] as const

export type VoiceRelationshipMemoryDraftAction = (typeof VOICE_RELATIONSHIP_MEMORY_DRAFT_ACTIONS)[number]

export const RELATIONSHIP_MEMORY_TIMELINE_WINDOW = 24 as const
export const RELATIONSHIP_MEMORY_EVENTS_WINDOW = 40 as const
export const RELATIONSHIP_MEMORY_INSIGHTS_LIMIT = 8 as const
export const RELATIONSHIP_MEMORY_MIN_CONFIDENCE = 0.55 as const

export type VoiceRelationshipMemoryProfilePublicView = {
  id: string
  organizationId: string
  relatedCustomerId: string | null
  relatedProspectId: string | null
  primaryContactName: string | null
  primaryPhoneNumber: string
  relationshipStatus: VoiceRelationshipStatus
  firstInteractionAt: string | null
  lastInteractionAt: string | null
  totalCallCount: number
  totalTalkTimeSeconds: number
  objectionCount: number
  buyingSignalCount: number
  escalationCount: number
  sentimentTrend: VoiceRelationshipSentimentTrend
  metadataJson: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type VoiceRelationshipMemoryEventPublicView = {
  id: string
  memoryProfileId: string
  sourceVoiceCallId: string | null
  sourceTranscriptSegmentId: string | null
  memoryType: VoiceRelationshipMemoryType
  evidenceText: string
  confidenceScore: number
  eventStatus: VoiceRelationshipMemoryEventStatus
  createdBySource: string
  createdAt: string
}

export type VoiceRelationshipTimelineItem = {
  id: string
  occurredAt: string
  kind:
    | "call"
    | "objection"
    | "buying_signal"
    | "risk"
    | "memory_event"
    | "transfer"
    | "coaching"
    | "operator_action"
  title: string
  evidenceText: string
  sourceVoiceCallId: string | null
  filterTags: string[]
}

export type VoiceRelationshipPrioritizedInsight = {
  id: string
  title: string
  summary: string
  score: number
  memoryType: VoiceRelationshipMemoryType | "composite"
  evidenceText: string
  unresolved: boolean
}

export type VoiceRelationshipMemoryReadinessSnapshot = {
  qaMarker: typeof VOICE_RELATIONSHIP_MEMORY_QA_MARKER
  schemaReady: boolean
  memoryExtractionStatus: "ready" | "degraded" | "unavailable"
  draftReviewBacklog: number
  acceptedDraftCount: number
  rejectedDraftCount: number
  unresolvedObjectionCount: number
  confidenceThreshold: number
  passiveModeEnabled: true
  autonomousActionsDisabled: true
  message: string
}

export type VoiceRelationshipMemoryWorkspaceSnapshot = {
  qaMarker: typeof VOICE_RELATIONSHIP_MEMORY_QA_MARKER
  profile: VoiceRelationshipMemoryProfilePublicView | null
  timeline: VoiceRelationshipTimelineItem[]
  priorObjections: VoiceRelationshipMemoryEventPublicView[]
  priorBuyingSignals: VoiceRelationshipMemoryEventPublicView[]
  decisionMakers: VoiceRelationshipMemoryEventPublicView[]
  followUpPreferences: VoiceRelationshipMemoryEventPublicView[]
  escalationHistory: VoiceRelationshipMemoryEventPublicView[]
  prioritizedInsights: VoiceRelationshipPrioritizedInsight[]
  pendingDraftCount: number
  teamVisibilityMessage: string
  windowed: true
  timelineLimit: number
  eventsLimit: number
}

export type VoiceRelationshipMemoryInsightsSnapshot = {
  qaMarker: typeof VOICE_RELATIONSHIP_MEMORY_QA_MARKER
  profileId: string
  insights: VoiceRelationshipPrioritizedInsight[]
  unresolvedObjectionCount: number
  highRiskScore: number
}
