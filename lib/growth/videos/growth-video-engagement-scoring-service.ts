/** Growth Engine A4 — Engagement scoring from page events (client-safe). */

import {
  GROWTH_VIDEO_ANALYTICS_QA_MARKER,
  type GrowthVideoAiEngagementSignal,
  type GrowthVideoPageEventType,
} from "@/lib/growth/videos/growth-video-types"

export const GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES = {
  page_view: 5,
  video_play: 10,
  watch_25: 15,
  watch_50: 25,
  watch_75: 40,
  watch_90: 60,
  cta_click: 80,
  calendar_click: 100,
} as const

export type GrowthVideoSessionEventRollup = {
  organizationId: string
  videoAssetId: string
  videoPageId: string
  visitorIdentifier: string | null
  sessionId: string
  totalViews: number
  totalPlays: number
  totalWatchSeconds: number
  highestPercentWatched: number
  totalCtaClicks: number
  totalCalendarClicks: number
  firstViewedAt: string | null
  lastViewedAt: string | null
}

export type GrowthVideoEngagementScoreResult = {
  engagementScore: number
  aiSignals: Record<GrowthVideoAiEngagementSignal, boolean>
  aiEngagementSummary: string
  visitConfidenceBonus: number
}

type RawPageEvent = {
  organization_id: string
  video_asset_id: string
  video_page_id: string
  visitor_identifier: string | null
  session_id: string | null
  event_type: string
  metadata_json: Record<string, unknown> | null
  created_at: string
}

function readEventPercent(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.percent ?? metadata?.progress_pct
  const value = typeof raw === "number" ? raw : Number(raw)
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

export function rollupGrowthVideoPageEventsBySession(events: RawPageEvent[]): GrowthVideoSessionEventRollup[] {
  const sessions = new Map<string, GrowthVideoSessionEventRollup>()

  for (const event of events) {
    const sessionId = (event.session_id ?? "").trim()
    if (!sessionId) continue

    const key = `${event.video_page_id}:${sessionId}`
    const existing =
      sessions.get(key) ??
      ({
        organizationId: event.organization_id,
        videoAssetId: event.video_asset_id,
        videoPageId: event.video_page_id,
        visitorIdentifier: event.visitor_identifier,
        sessionId,
        totalViews: 0,
        totalPlays: 0,
        totalWatchSeconds: 0,
        highestPercentWatched: 0,
        totalCtaClicks: 0,
        totalCalendarClicks: 0,
        firstViewedAt: null,
        lastViewedAt: null,
      } satisfies GrowthVideoSessionEventRollup)

    if (event.visitor_identifier && !existing.visitorIdentifier) {
      existing.visitorIdentifier = event.visitor_identifier
    }

    const occurredAt = event.created_at
    if (!existing.firstViewedAt || occurredAt < existing.firstViewedAt) {
      existing.firstViewedAt = occurredAt
    }
    if (!existing.lastViewedAt || occurredAt > existing.lastViewedAt) {
      existing.lastViewedAt = occurredAt
    }

    const eventType = event.event_type as GrowthVideoPageEventType
    const percent = readEventPercent(event.metadata_json)

    if (eventType === "page_view") existing.totalViews += 1
    if (eventType === "video_play") existing.totalPlays += 1
    if (eventType === "cta_click") existing.totalCtaClicks += 1
    if (eventType === "calendar_click") existing.totalCalendarClicks += 1
    if (eventType === "video_progress" || eventType === "video_complete") {
      existing.highestPercentWatched = Math.max(existing.highestPercentWatched, percent)
    }
    if (eventType === "video_complete") {
      existing.highestPercentWatched = Math.max(existing.highestPercentWatched, 90)
    }

    sessions.set(key, existing)
  }

  return [...sessions.values()]
}

export function computeGrowthVideoMilestoneScore(rollup: GrowthVideoSessionEventRollup): number {
  let score = 0

  if (rollup.totalViews > 0) score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.page_view)
  if (rollup.totalPlays > 0) score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.video_play)
  if (rollup.highestPercentWatched >= 25 || rollup.totalWatchSeconds > 0) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.watch_25)
  }
  if (rollup.highestPercentWatched >= 50) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.watch_50)
  }
  if (rollup.highestPercentWatched >= 75) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.watch_75)
  }
  if (rollup.highestPercentWatched >= 90) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.watch_90)
  }
  if (rollup.totalCtaClicks > 0) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.cta_click)
  }
  if (rollup.totalCalendarClicks > 0) {
    score = Math.max(score, GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.calendar_click)
  }

  return score
}

export function computeGrowthVideoVisitConfidenceBonus(sessionCount: number): number {
  if (sessionCount <= 1) return 0
  return Math.min((sessionCount - 1) * 5, 15)
}

export function buildGrowthVideoAiEngagementSignals(input: {
  rollup: GrowthVideoSessionEventRollup
  engagementScore: number
  visitorSessionCount: number
}): Record<GrowthVideoAiEngagementSignal, boolean> {
  return {
    video_viewed: input.rollup.totalViews > 0,
    video_high_intent: input.engagementScore >= GROWTH_VIDEO_ENGAGEMENT_SIGNAL_SCORES.watch_75,
    video_cta_clicked: input.rollup.totalCtaClicks > 0,
    video_calendar_clicked: input.rollup.totalCalendarClicks > 0,
    video_return_visitor: input.visitorSessionCount > 1,
  }
}

export function buildGrowthVideoAiEngagementSummary(input: {
  rollup: GrowthVideoSessionEventRollup
  engagementScore: number
  aiSignals: Record<GrowthVideoAiEngagementSignal, boolean>
}): string {
  const parts: string[] = []
  if (input.aiSignals.video_viewed) parts.push("viewed video page")
  if (input.rollup.highestPercentWatched >= 50) {
    parts.push(`watched ${Math.round(input.rollup.highestPercentWatched)}%`)
  }
  if (input.aiSignals.video_cta_clicked) parts.push("clicked CTA")
  if (input.aiSignals.video_calendar_clicked) parts.push("opened calendar")
  if (input.aiSignals.video_return_visitor) parts.push("return visitor")
  if (input.aiSignals.video_high_intent) parts.push("high intent")

  const activity = parts.length > 0 ? parts.join(", ") : "minimal engagement"
  return `Video engagement score ${input.engagementScore}: ${activity}.`
}

export function computeGrowthVideoEngagementScore(input: {
  rollup: GrowthVideoSessionEventRollup
  visitorSessionCount: number
}): GrowthVideoEngagementScoreResult {
  const milestoneScore = computeGrowthVideoMilestoneScore(input.rollup)
  const visitConfidenceBonus = computeGrowthVideoVisitConfidenceBonus(input.visitorSessionCount)
  const engagementScore = milestoneScore + visitConfidenceBonus
  const aiSignals = buildGrowthVideoAiEngagementSignals({
    rollup: input.rollup,
    engagementScore,
    visitorSessionCount: input.visitorSessionCount,
  })
  const aiEngagementSummary = buildGrowthVideoAiEngagementSummary({
    rollup: input.rollup,
    engagementScore,
    aiSignals,
  })

  return {
    engagementScore,
    aiSignals,
    aiEngagementSummary,
    visitConfidenceBonus,
  }
}

export function growthVideoEngagementScoringSafetyPayload() {
  return {
    qa_marker: GROWTH_VIDEO_ANALYTICS_QA_MARKER,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    no_sequence_triggers: true,
    no_automation_triggers: true,
  }
}
