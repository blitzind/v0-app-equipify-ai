/** Growth Engine D3 — Video engagement intelligence types (client-safe). */

import type { GrowthSequenceVideoD3Signal } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

export const GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER =
  "growth-sequence-video-intelligence-d3-v1" as const

export const GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_CONFIRM =
  "RUN_GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_CERTIFICATION" as const

export const GROWTH_VIDEO_INTELLIGENCE_TIMELINE_EVENT_TYPES = [
  "video_page_viewed",
  "video_video_played",
  "video_video_completed",
  "video_cta_clicked",
  "video_calendar_clicked",
] as const

export type GrowthVideoIntelligenceTimelineEventType =
  (typeof GROWTH_VIDEO_INTELLIGENCE_TIMELINE_EVENT_TYPES)[number]

export type GrowthVideoIntelligenceMetrics = {
  highestPercentWatched: number
  totalViews: number
  totalCtaClicks: number
  totalCalendarClicks: number
  lastVideoViewedAt: string | null
  lastVideoPageId: string | null
  lastVideoAssetId: string | null
  videoEngagementScore: number
  sessionCount: number
  primarySessionId: string | null
}

export type GrowthVideoRelationshipContext = {
  lastVideoViewedAt: string | null
  lastVideoPageId: string | null
  videoEngagementScore: number
  highestVideoCompletionPercent: number
  videoReturnVisitor: boolean
}

export type GrowthVideoNbaSuggestion = {
  signal: GrowthSequenceVideoD3Signal | string
  suggestedAction: string
  mappedNextBestAction: string | null
  reason: string
  requiresHumanReview: true
  autonomousExecutionEnabled: false
}

export type GrowthVideoOpportunitySignal = {
  signal:
    | "video_high_intent"
    | "video_return_visitor"
    | "video_multiple_views"
    | "video_meeting_ready"
  reason: string
  metadata: Record<string, unknown>
}

export type GrowthVideoCallWorkspaceContext = {
  lastPersonalizedVideoTitle: string | null
  pageTitle: string | null
  highestCompletionPercent: number
  ctaClicked: boolean
  calendarClicked: boolean
  numberOfViews: number
  lastViewedAt: string | null
}

export type GrowthVideoMeetingPrepContext = {
  prospectWatched: string | null
  completionPercent: number
  viewCount: number
  ctaClicked: boolean
  calendarClicked: boolean
}

export type GrowthVideoIntelligenceTimelinePreview = {
  eventType: GrowthVideoIntelligenceTimelineEventType
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type GrowthVideoIntelligenceConversationPreview = {
  eventKind: string
  title: string
  summary: string
  payload: Record<string, unknown>
}

export type GrowthVideoIntelligenceSnapshot = {
  qa_marker: typeof GROWTH_SEQUENCE_VIDEO_INTELLIGENCE_QA_MARKER
  metrics: GrowthVideoIntelligenceMetrics
  signals: GrowthSequenceVideoD3Signal[]
  timelineEvents: GrowthVideoIntelligenceTimelinePreview[]
  conversationActivities: GrowthVideoIntelligenceConversationPreview[]
  relationshipContext: GrowthVideoRelationshipContext
  nextBestActionSuggestions: GrowthVideoNbaSuggestion[]
  opportunitySignals: GrowthVideoOpportunitySignal[]
  callWorkspaceContext: GrowthVideoCallWorkspaceContext
  meetingPreparationContext: GrowthVideoMeetingPrepContext
  analyticsAttribution: Record<string, string | null>
  requiresHumanReview: true
  autonomousExecutionEnabled: false
  orchestrationEnabled: false
}
