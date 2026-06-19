/** Growth Engine SP-INT-1 — Share page intelligence types (client-safe). */

export const GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER = "growth-share-page-intelligence-sp-int-1-v1" as const

export const GROWTH_SHARE_PAGE_INTELLIGENCE_CONFIRM =
  "RUN_GROWTH_SHARE_PAGE_INTELLIGENCE_CERTIFICATION" as const

export const GROWTH_SHARE_PAGE_INTELLIGENCE_METADATA_KEY = "growth_share_page_intelligence" as const

export const GROWTH_SHARE_PAGE_INTELLIGENCE_TIMELINE_EVENT_TYPES = [
  "share_page_viewed",
  "share_page_cta_clicked",
  "share_page_calendar_clicked",
  "share_page_return_visit",
  "share_page_high_intent",
] as const

export type GrowthSharePageIntelligenceTimelineEventType =
  (typeof GROWTH_SHARE_PAGE_INTELLIGENCE_TIMELINE_EVENT_TYPES)[number]

export type GrowthSharePageIntelligenceSignal =
  | "share_page_viewed"
  | "share_page_high_intent"
  | "share_page_cta_clicked"
  | "share_page_calendar_clicked"
  | "share_page_return_visitor"
  | "share_page_multiple_views"

export type GrowthSharePageIntelligenceMetrics = {
  totalViews: number
  uniqueVisitors: number
  ctaClicks: number
  calendarClicks: number
  avgDurationMs: number
  lastSharePageViewedAt: string | null
  lastSharePageId: string | null
  sharePageEngagementScore: number
  sessionCount: number
  primarySessionId: string | null
}

export type GrowthSharePageRelationshipContext = {
  lastSharePageViewedAt: string | null
  lastSharePageId: string | null
  sharePageEngagementScore: number
  returnVisitor: boolean
  calendarInterest: boolean
  ctaInterest: boolean
}

export type GrowthSharePageNbaSuggestion = {
  signal: GrowthSharePageIntelligenceSignal | string
  suggestedAction: string
  mappedNextBestAction: string | null
  reason: string
  requiresHumanReview: true
  autonomousExecutionEnabled: false
}

export type GrowthSharePageOpportunitySignal = {
  signal:
    | "share_page_high_intent"
    | "share_page_return_visitor"
    | "share_page_multiple_views"
    | "share_page_meeting_ready"
  reason: string
  metadata: Record<string, unknown>
}

export type GrowthSharePageCallWorkspaceContext = {
  lastSharePageTitle: string | null
  totalViews: number
  ctaClicked: boolean
  calendarClicked: boolean
  returnVisitor: boolean
  lastViewedAt: string | null
  suggestedTalkingPoints: string[]
}

export type GrowthSharePageMeetingPrepContext = {
  prospectViewedPage: boolean
  prospectClickedCta: boolean
  prospectClickedCalendar: boolean
  numberOfVisits: number
  engagementScore: number
  suggestedDiscussionTopics: string[]
}

export type GrowthSharePageIntelligenceTimelinePreview = {
  eventType: GrowthSharePageIntelligenceTimelineEventType
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type GrowthSharePageIntelligenceConversationPreview = {
  eventKind: string
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type GrowthSharePageIntelligenceAnalyticsAttribution = {
  sequence_execution_id: string | null
  sequence_step_id: string | null
  sequence_enrollment_step_id: string | null
  enrollment_id: string | null
  share_page_id: string | null
}

export type GrowthSharePageIntelligenceEngagementSummary = {
  viewCount: number
  uniqueVisitors: number
  ctaClicks: number
  calendarClicks: number
  lastActivityAt: string | null
}

export type GrowthSharePageIntelligenceMetadata = {
  qa_marker: typeof GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER
  updated_at: string
  share_page_id: string | null
  relationship_context: GrowthSharePageRelationshipContext
  meeting_preparation_context: GrowthSharePageMeetingPrepContext
  call_workspace_context: GrowthSharePageCallWorkspaceContext
  nba_suggestions: GrowthSharePageNbaSuggestion[]
  opportunity_signals: GrowthSharePageOpportunitySignal[]
  engagement_summary: GrowthSharePageIntelligenceEngagementSummary
  metrics?: GrowthSharePageIntelligenceMetrics
  signals?: GrowthSharePageIntelligenceSignal[]
  requires_human_review: true
  autonomous_execution_enabled: false
  orchestration_enabled: false
}

export type GrowthSharePageIntelligenceSnapshot = {
  qa_marker: typeof GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER
  metrics: GrowthSharePageIntelligenceMetrics
  signals: GrowthSharePageIntelligenceSignal[]
  timelineEvents: GrowthSharePageIntelligenceTimelinePreview[]
  conversationActivities: GrowthSharePageIntelligenceConversationPreview[]
  relationshipContext: GrowthSharePageRelationshipContext
  nextBestActionSuggestions: GrowthSharePageNbaSuggestion[]
  opportunitySignals: GrowthSharePageOpportunitySignal[]
  callWorkspaceContext: GrowthSharePageCallWorkspaceContext
  meetingPreparationContext: GrowthSharePageMeetingPrepContext
  engagementSummary: GrowthSharePageIntelligenceEngagementSummary
  analyticsAttribution: GrowthSharePageIntelligenceAnalyticsAttribution
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  orchestrationEnabled: false
}

export type GrowthSharePageIntelligenceApiResponse = {
  relationship_context: GrowthSharePageRelationshipContext
  meeting_preparation_context: GrowthSharePageMeetingPrepContext
  call_workspace_context: GrowthSharePageCallWorkspaceContext
  nba_suggestions: GrowthSharePageNbaSuggestion[]
  opportunity_signals: GrowthSharePageOpportunitySignal[]
  timeline: GrowthSharePageIntelligenceTimelinePreview[]
  activities: GrowthSharePageIntelligenceConversationPreview[]
  engagement_summary: GrowthSharePageIntelligenceEngagementSummary
  metrics: GrowthSharePageIntelligenceMetrics
  signals: GrowthSharePageIntelligenceSignal[]
  analytics_attribution: GrowthSharePageIntelligenceAnalyticsAttribution
}

export function growthSharePageIntelligenceSafetyPayload() {
  return {
    qa_marker: GROWTH_SHARE_PAGE_INTELLIGENCE_QA_MARKER,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
    orchestration_enabled: false as const,
    worker_execution_enabled: false as const,
  }
}
