/** Growth Engine D3 — Video intelligence pure mappings (client-safe). */

import type { GrowthSequenceVideoD3Signal } from "@/lib/growth/sequences/growth-sequence-video-attachment-types"
import type {
  GrowthVideoCallWorkspaceContext,
  GrowthVideoIntelligenceMetrics,
  GrowthVideoMeetingPrepContext,
  GrowthVideoNbaSuggestion,
  GrowthVideoOpportunitySignal,
  GrowthVideoRelationshipContext,
} from "@/lib/growth/sequences/growth-sequence-video-intelligence-types"

export type GrowthVideoIntelligenceSummaryRow = {
  id: string
  video_asset_id: string
  video_page_id: string
  total_views: number
  highest_percent_watched: number
  total_cta_clicks: number
  total_calendar_clicks: number
  last_viewed_at: string | null
  engagement_score: number
  session_id: string
  visitor_identifier: string | null
}

export function deriveGrowthVideoIntelligenceSignals(input: {
  totalViews: number
  highestPercentWatched: number
  totalCtaClicks: number
  totalCalendarClicks: number
  sessionCount: number
}): GrowthSequenceVideoD3Signal[] {
  const signals: GrowthSequenceVideoD3Signal[] = []
  if (input.totalViews > 0) signals.push("video_viewed")
  if (input.highestPercentWatched >= 75 || input.totalCtaClicks > 0 || input.totalCalendarClicks > 0) {
    signals.push("video_high_intent")
  }
  if (input.totalCtaClicks > 0) signals.push("video_cta_clicked")
  if (input.totalCalendarClicks > 0) signals.push("video_calendar_clicked")
  if (input.sessionCount > 1) {
    signals.push("video_return_visitor")
    signals.push("video_multiple_sessions")
  }
  if (input.highestPercentWatched >= 90) signals.push("video_completed")
  return signals
}

export function buildGrowthVideoIntelligenceMetrics(
  rows: GrowthVideoIntelligenceSummaryRow[],
): GrowthVideoIntelligenceMetrics {
  if (rows.length === 0) {
    return {
      highestPercentWatched: 0,
      totalViews: 0,
      totalCtaClicks: 0,
      totalCalendarClicks: 0,
      lastVideoViewedAt: null,
      lastVideoPageId: null,
      lastVideoAssetId: null,
      videoEngagementScore: 0,
      sessionCount: 0,
      primarySessionId: null,
    }
  }

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalViews += Number(row.total_views ?? 0)
      acc.totalCtaClicks += Number(row.total_cta_clicks ?? 0)
      acc.totalCalendarClicks += Number(row.total_calendar_clicks ?? 0)
      acc.highestPercentWatched = Math.max(
        acc.highestPercentWatched,
        Number(row.highest_percent_watched ?? 0),
      )
      acc.videoEngagementScore = Math.max(acc.videoEngagementScore, Number(row.engagement_score ?? 0))
      return acc
    },
    {
      totalViews: 0,
      totalCtaClicks: 0,
      totalCalendarClicks: 0,
      highestPercentWatched: 0,
      videoEngagementScore: 0,
    },
  )

  const latest = rows[0]
  const visitorKeys = new Set<string>()
  for (const row of rows) {
    const key =
      (typeof row.visitor_identifier === "string" && row.visitor_identifier.trim()) || row.session_id
    if (key) visitorKeys.add(key)
  }

  return {
    highestPercentWatched: totals.highestPercentWatched,
    totalViews: totals.totalViews,
    totalCtaClicks: totals.totalCtaClicks,
    totalCalendarClicks: totals.totalCalendarClicks,
    lastVideoViewedAt: latest.last_viewed_at,
    lastVideoPageId: latest.video_page_id,
    lastVideoAssetId: latest.video_asset_id,
    videoEngagementScore: totals.videoEngagementScore,
    sessionCount: visitorKeys.size,
    primarySessionId: latest.session_id ?? null,
  }
}

export function buildGrowthVideoRelationshipContext(
  metrics: GrowthVideoIntelligenceMetrics,
): GrowthVideoRelationshipContext {
  return {
    lastVideoViewedAt: metrics.lastVideoViewedAt,
    lastVideoPageId: metrics.lastVideoPageId,
    videoEngagementScore: metrics.videoEngagementScore,
    highestVideoCompletionPercent: metrics.highestPercentWatched,
    videoReturnVisitor: metrics.sessionCount > 1,
  }
}

export function mapGrowthVideoSignalsToNbaSuggestions(input: {
  signals: GrowthSequenceVideoD3Signal[]
  metrics: GrowthVideoIntelligenceMetrics
}): GrowthVideoNbaSuggestion[] {
  const suggestions: GrowthVideoNbaSuggestion[] = []
  const base = {
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
  }

  if (input.signals.includes("video_calendar_clicked")) {
    suggestions.push({
      ...base,
      signal: "video_calendar_clicked",
      suggestedAction: "schedule_meeting",
      mappedNextBestAction: "call_immediately",
      reason: "Prospect clicked the calendar CTA on a personalized video page.",
    })
  }
  if (input.signals.includes("video_cta_clicked")) {
    suggestions.push({
      ...base,
      signal: "video_cta_clicked",
      suggestedAction: "call_immediately",
      mappedNextBestAction: "call_immediately",
      reason: "Prospect clicked the primary CTA on a personalized video page.",
    })
  }
  if (input.metrics.highestPercentWatched >= 95 || input.signals.includes("video_completed")) {
    suggestions.push({
      ...base,
      signal: "video_completed",
      suggestedAction: "high_intent_follow_up",
      mappedNextBestAction: "immediate_follow_up",
      reason: "Prospect watched most of the personalized video.",
    })
  }
  if (input.signals.includes("video_multiple_sessions") || input.signals.includes("video_return_visitor")) {
    suggestions.push({
      ...base,
      signal: "video_multiple_sessions",
      suggestedAction: "personalized_outreach",
      mappedNextBestAction: "reengage",
      reason: "Prospect returned to the personalized video page in multiple sessions.",
    })
  }
  if (
    input.signals.includes("video_viewed") &&
    !input.signals.includes("video_high_intent") &&
    !input.signals.includes("video_cta_clicked") &&
    !input.signals.includes("video_calendar_clicked")
  ) {
    suggestions.push({
      ...base,
      signal: "video_viewed",
      suggestedAction: "continue_nurture",
      mappedNextBestAction: "wait_follow_up",
      reason: "Prospect viewed the personalized video page without high-intent actions yet.",
    })
  }

  return suggestions
}

export function buildGrowthVideoOpportunitySignals(input: {
  signals: GrowthSequenceVideoD3Signal[]
  metrics: GrowthVideoIntelligenceMetrics
  videoPageId: string
  attachmentId?: string | null
}): GrowthVideoOpportunitySignal[] {
  const metadataBase = {
    video_page_id: input.videoPageId,
    attachment_id: input.attachmentId ?? null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
  const out: GrowthVideoOpportunitySignal[] = []

  if (input.signals.includes("video_high_intent")) {
    out.push({
      signal: "video_high_intent",
      reason: "Personalized video engagement crossed high-intent threshold.",
      metadata: { ...metadataBase, engagement_score: input.metrics.videoEngagementScore },
    })
  }
  if (input.signals.includes("video_return_visitor")) {
    out.push({
      signal: "video_return_visitor",
      reason: "Prospect returned to the personalized video page.",
      metadata: { ...metadataBase, session_count: input.metrics.sessionCount },
    })
  }
  if (input.metrics.totalViews > 1) {
    out.push({
      signal: "video_multiple_views",
      reason: "Prospect viewed the personalized video page multiple times.",
      metadata: { ...metadataBase, total_views: input.metrics.totalViews },
    })
  }
  if (input.signals.includes("video_calendar_clicked") || input.metrics.totalCalendarClicks > 0) {
    out.push({
      signal: "video_meeting_ready",
      reason: "Prospect clicked calendar from personalized video page.",
      metadata: { ...metadataBase, calendar_clicks: input.metrics.totalCalendarClicks },
    })
  }

  return out
}

export function buildGrowthVideoCallWorkspaceContext(input: {
  metrics: GrowthVideoIntelligenceMetrics
  pageTitle?: string | null
  videoTitle?: string | null
}): GrowthVideoCallWorkspaceContext {
  return {
    lastPersonalizedVideoTitle: input.videoTitle ?? input.pageTitle ?? null,
    pageTitle: input.pageTitle ?? null,
    highestCompletionPercent: input.metrics.highestPercentWatched,
    ctaClicked: input.metrics.totalCtaClicks > 0,
    calendarClicked: input.metrics.totalCalendarClicks > 0,
    numberOfViews: input.metrics.totalViews,
    lastViewedAt: input.metrics.lastVideoViewedAt,
  }
}

export function buildGrowthVideoMeetingPrepContext(input: {
  metrics: GrowthVideoIntelligenceMetrics
  videoTitle?: string | null
}): GrowthVideoMeetingPrepContext {
  return {
    prospectWatched: input.videoTitle ?? null,
    completionPercent: input.metrics.highestPercentWatched,
    viewCount: input.metrics.totalViews,
    ctaClicked: input.metrics.totalCtaClicks > 0,
    calendarClicked: input.metrics.totalCalendarClicks > 0,
  }
}

export function readGrowthVideoMeetingPrepFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthVideoMeetingPrepContext | null {
  const raw = leadMetadata?.growth_video_d3
  if (!raw || typeof raw !== "object") return null
  const meeting = (raw as Record<string, unknown>).meeting_preparation_context
  if (!meeting || typeof meeting !== "object") return null
  return meeting as GrowthVideoMeetingPrepContext
}

export function readGrowthVideoCallWorkspaceFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthVideoCallWorkspaceContext | null {
  const raw = leadMetadata?.growth_video_d3
  if (!raw || typeof raw !== "object") return null
  const context = (raw as Record<string, unknown>).call_workspace_context
  if (!context || typeof context !== "object") return null
  return context as GrowthVideoCallWorkspaceContext
}
