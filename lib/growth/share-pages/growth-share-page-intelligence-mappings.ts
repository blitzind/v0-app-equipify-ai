/** Growth Engine SP-INT-1 — Share page intelligence pure mappings (client-safe). */

import type {
  GrowthSharePage,
  GrowthSharePageAnalyticsSummary,
} from "@/lib/growth/share-pages/share-page-types"
import type {
  GrowthSharePageCallWorkspaceContext,
  GrowthSharePageIntelligenceEngagementSummary,
  GrowthSharePageIntelligenceMetrics,
  GrowthSharePageIntelligenceSignal,
  GrowthSharePageMeetingPrepContext,
  GrowthSharePageNbaSuggestion,
  GrowthSharePageOpportunitySignal,
  GrowthSharePageRelationshipContext,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"

export function deriveGrowthSharePageIntelligenceSignals(input: {
  totalViews: number
  ctaClicks: number
  calendarClicks: number
  sessionCount: number
  highIntent?: boolean
}): GrowthSharePageIntelligenceSignal[] {
  const signals: GrowthSharePageIntelligenceSignal[] = []
  if (input.totalViews > 0) signals.push("share_page_viewed")
  if (input.ctaClicks > 0) signals.push("share_page_cta_clicked")
  if (input.calendarClicks > 0) signals.push("share_page_calendar_clicked")
  if (input.highIntent || input.ctaClicks > 0 || input.calendarClicks > 0) {
    signals.push("share_page_high_intent")
  }
  if (input.sessionCount > 1) signals.push("share_page_return_visitor")
  if (input.totalViews > 1) signals.push("share_page_multiple_views")
  return signals
}

export function buildGrowthSharePageIntelligenceMetrics(input: {
  page: GrowthSharePage
  analytics: GrowthSharePageAnalyticsSummary | null
  sessionCount: number
  primarySessionId: string | null
}): GrowthSharePageIntelligenceMetrics {
  const engagement = input.analytics?.engagementSummary ?? input.page.engagementSummary
  const calendarClicks =
    engagement.bookingStartedCount + engagement.bookingCompletedCount

  const sharePageEngagementScore = Math.min(
    100,
    Math.max(
      input.page.evidenceCoverageScore ?? 0,
      engagement.viewCount * 8 +
        engagement.ctaClickCount * 18 +
        calendarClicks * 22 +
        Math.max(0, input.sessionCount - 1) * 12,
    ),
  )

  return {
    totalViews: engagement.viewCount,
    uniqueVisitors: engagement.uniqueSessionCount,
    ctaClicks: engagement.ctaClickCount,
    calendarClicks,
    avgDurationMs: engagement.avgDurationMs,
    lastSharePageViewedAt: input.analytics?.lastViewedAt ?? input.page.lastViewedAt,
    lastSharePageId: input.page.id,
    sharePageEngagementScore,
    sessionCount: input.sessionCount,
    primarySessionId: input.primarySessionId,
  }
}

export function buildGrowthSharePageIntelligenceEngagementSummary(
  metrics: GrowthSharePageIntelligenceMetrics,
): GrowthSharePageIntelligenceEngagementSummary {
  return {
    viewCount: metrics.totalViews,
    uniqueVisitors: metrics.uniqueVisitors,
    ctaClicks: metrics.ctaClicks,
    calendarClicks: metrics.calendarClicks,
    lastActivityAt: metrics.lastSharePageViewedAt,
  }
}

export function buildGrowthSharePageRelationshipContext(
  metrics: GrowthSharePageIntelligenceMetrics,
): GrowthSharePageRelationshipContext {
  return {
    lastSharePageViewedAt: metrics.lastSharePageViewedAt,
    lastSharePageId: metrics.lastSharePageId,
    sharePageEngagementScore: metrics.sharePageEngagementScore,
    returnVisitor: metrics.sessionCount > 1,
    calendarInterest: metrics.calendarClicks > 0,
    ctaInterest: metrics.ctaClicks > 0,
  }
}

export function mapGrowthSharePageSignalsToNbaSuggestions(input: {
  signals: GrowthSharePageIntelligenceSignal[]
  metrics: GrowthSharePageIntelligenceMetrics
}): GrowthSharePageNbaSuggestion[] {
  const suggestions: GrowthSharePageNbaSuggestion[] = []
  const base = {
    requiresHumanReview: true as const,
    autonomousExecutionEnabled: false as const,
  }

  if (input.signals.includes("share_page_calendar_clicked")) {
    suggestions.push({
      ...base,
      signal: "share_page_calendar_clicked",
      suggestedAction: "schedule_meeting",
      mappedNextBestAction: "call_immediately",
      reason: "Prospect clicked the calendar CTA on a personalized share page.",
    })
  }
  if (input.signals.includes("share_page_cta_clicked")) {
    suggestions.push({
      ...base,
      signal: "share_page_cta_clicked",
      suggestedAction: "immediate_follow_up",
      mappedNextBestAction: "immediate_follow_up",
      reason: "Prospect clicked the primary CTA on a personalized share page.",
    })
  }
  if (input.signals.includes("share_page_multiple_views")) {
    suggestions.push({
      ...base,
      signal: "share_page_multiple_views",
      suggestedAction: "personalized_outreach",
      mappedNextBestAction: "reengage",
      reason: "Prospect viewed the personalized share page multiple times.",
    })
  }
  if (input.signals.includes("share_page_return_visitor")) {
    suggestions.push({
      ...base,
      signal: "share_page_return_visitor",
      suggestedAction: "reengage",
      mappedNextBestAction: "reengage",
      reason: "Prospect returned to the personalized share page in a new session.",
    })
  }
  if (
    input.signals.includes("share_page_viewed") &&
    input.metrics.totalViews === 1 &&
    !input.signals.includes("share_page_high_intent")
  ) {
    suggestions.push({
      ...base,
      signal: "share_page_viewed",
      suggestedAction: "continue_nurture",
      mappedNextBestAction: "wait_follow_up",
      reason: "Prospect viewed the share page once without high-intent actions yet.",
    })
  }

  return suggestions
}

export function buildGrowthSharePageOpportunitySignals(input: {
  signals: GrowthSharePageIntelligenceSignal[]
  metrics: GrowthSharePageIntelligenceMetrics
  sharePageId: string
}): GrowthSharePageOpportunitySignal[] {
  const metadataBase = {
    share_page_id: input.sharePageId,
    requires_human_review: true,
    autonomous_execution_enabled: false,
  }
  const out: GrowthSharePageOpportunitySignal[] = []

  if (input.signals.includes("share_page_high_intent")) {
    out.push({
      signal: "share_page_high_intent",
      reason: "Share page engagement crossed high-intent threshold.",
      metadata: { ...metadataBase, engagement_score: input.metrics.sharePageEngagementScore },
    })
  }
  if (input.signals.includes("share_page_return_visitor")) {
    out.push({
      signal: "share_page_return_visitor",
      reason: "Prospect returned to the personalized share page.",
      metadata: { ...metadataBase, session_count: input.metrics.sessionCount },
    })
  }
  if (input.signals.includes("share_page_multiple_views")) {
    out.push({
      signal: "share_page_multiple_views",
      reason: "Prospect viewed the personalized share page multiple times.",
      metadata: { ...metadataBase, total_views: input.metrics.totalViews },
    })
  }
  if (input.signals.includes("share_page_calendar_clicked") || input.metrics.calendarClicks > 0) {
    out.push({
      signal: "share_page_meeting_ready",
      reason: "Prospect clicked calendar from personalized share page.",
      metadata: { ...metadataBase, calendar_clicks: input.metrics.calendarClicks },
    })
  }

  return out
}

export function buildGrowthSharePageCallWorkspaceContext(input: {
  metrics: GrowthSharePageIntelligenceMetrics
  pageTitle?: string | null
}): GrowthSharePageCallWorkspaceContext {
  const talkingPoints: string[] = []
  if (input.metrics.totalViews > 0) {
    talkingPoints.push(`Prospect viewed the share page ${input.metrics.totalViews} time(s).`)
  }
  if (input.metrics.ctaClicks > 0) {
    talkingPoints.push("Prospect clicked the share page CTA.")
  }
  if (input.metrics.calendarClicks > 0) {
    talkingPoints.push("Prospect clicked the calendar link on the share page.")
  }
  if (input.metrics.sessionCount > 1) {
    talkingPoints.push("Prospect returned to the share page in multiple sessions.")
  }

  return {
    lastSharePageTitle: input.pageTitle ?? null,
    totalViews: input.metrics.totalViews,
    ctaClicked: input.metrics.ctaClicks > 0,
    calendarClicked: input.metrics.calendarClicks > 0,
    returnVisitor: input.metrics.sessionCount > 1,
    lastViewedAt: input.metrics.lastSharePageViewedAt,
    suggestedTalkingPoints: talkingPoints,
  }
}

export function buildGrowthSharePageMeetingPrepContext(input: {
  metrics: GrowthSharePageIntelligenceMetrics
  pageTitle?: string | null
}): GrowthSharePageMeetingPrepContext {
  const topics: string[] = []
  if (input.metrics.totalViews > 0) {
    topics.push(`Prospect viewed personalized page${input.pageTitle ? `: ${input.pageTitle}` : ""}.`)
  }
  if (input.metrics.ctaClicks > 0) topics.push("Prospect clicked the share page CTA.")
  if (input.metrics.calendarClicks > 0) topics.push("Prospect clicked the calendar on the share page.")
  if (input.metrics.sessionCount > 1) topics.push("Prospect returned to the share page.")

  return {
    prospectViewedPage: input.metrics.totalViews > 0,
    prospectClickedCta: input.metrics.ctaClicks > 0,
    prospectClickedCalendar: input.metrics.calendarClicks > 0,
    numberOfVisits: input.metrics.totalViews,
    engagementScore: input.metrics.sharePageEngagementScore,
    suggestedDiscussionTopics: topics,
  }
}

export function readGrowthSharePageMeetingPrepFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthSharePageMeetingPrepContext | null {
  const raw = leadMetadata?.growth_share_page_intelligence
  if (!raw || typeof raw !== "object") return null
  const meeting = (raw as Record<string, unknown>).meeting_preparation_context
  if (!meeting || typeof meeting !== "object") return null
  return meeting as GrowthSharePageMeetingPrepContext
}

export function readGrowthSharePageCallWorkspaceFromLeadMetadata(
  leadMetadata: Record<string, unknown> | null | undefined,
): GrowthSharePageCallWorkspaceContext | null {
  const raw = leadMetadata?.growth_share_page_intelligence
  if (!raw || typeof raw !== "object") return null
  const context = (raw as Record<string, unknown>).call_workspace_context
  if (!context || typeof context !== "object") return null
  return context as GrowthSharePageCallWorkspaceContext
}
