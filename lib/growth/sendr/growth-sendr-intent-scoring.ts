/** GS-SENDR-2E — Deterministic SENDR intent scoring (client-safe, no AI). */

import {
  GROWTH_SENDR_INTENT_LEVEL_THRESHOLDS,
  GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS,
  type GrowthSendrIntentLevel,
} from "@/lib/growth/sendr/growth-sendr-config"

export type GrowthSendrIntentSignals = {
  pageViews: number
  videoStarts: number
  videoCompletes: number
  ctaClicks: number
  calendarOpens: number
  bookingStarts: number
  bookingCompletes: number
  uniqueSessions: number
  repeatSessions: number
}

export type GrowthSendrIntentScoreResult = {
  intentScore: number
  intentLevel: GrowthSendrIntentLevel
  signalBreakdown: Record<string, number>
}

export function emptySendrIntentSignals(): GrowthSendrIntentSignals {
  return {
    pageViews: 0,
    videoStarts: 0,
    videoCompletes: 0,
    ctaClicks: 0,
    calendarOpens: 0,
    bookingStarts: 0,
    bookingCompletes: 0,
    uniqueSessions: 0,
    repeatSessions: 0,
  }
}

export function resolveSendrIntentLevel(score: number): GrowthSendrIntentLevel {
  if (score >= GROWTH_SENDR_INTENT_LEVEL_THRESHOLDS.high) return "high"
  if (score >= GROWTH_SENDR_INTENT_LEVEL_THRESHOLDS.medium) return "medium"
  return "low"
}

/** Deterministic weighted sum — identical inputs always produce identical output. */
export function calculateSendrIntentScore(signals: GrowthSendrIntentSignals): GrowthSendrIntentScoreResult {
  const breakdown: Record<string, number> = {
    page_view: signals.pageViews * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.page_view,
    video_start: signals.videoStarts * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.video_start,
    video_complete: signals.videoCompletes * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.video_complete,
    cta_click: signals.ctaClicks * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.cta_click,
    calendar_open: signals.calendarOpens * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.calendar_open,
    booking_started: signals.bookingStarts * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.booking_started,
    booking_completed: signals.bookingCompletes * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.booking_completed,
    repeat_visits: signals.repeatSessions * GROWTH_SENDR_INTENT_SIGNAL_WEIGHTS.repeat_visit,
  }

  const raw = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  const intentScore = Math.min(100, Math.max(0, Math.round(raw)))

  return {
    intentScore,
    intentLevel: resolveSendrIntentLevel(intentScore),
    signalBreakdown: breakdown,
  }
}

export type GrowthSendrEngagementRates = {
  viewRate: number
  ctaRate: number
  bookingRate: number
  completionRate: number
  repeatEngagementRate: number
}

export function calculateSendrEngagementRates(input: {
  pageViews: number
  uniqueVisitors: number
  repeatVisitors: number
  ctaClicks: number
  bookingCompletes: number
  videoStarts: number
  videoCompletes: number
  outboundSends?: number
}): GrowthSendrEngagementRates {
  const denominator = input.outboundSends && input.outboundSends > 0 ? input.outboundSends : input.pageViews
  const viewRate = denominator > 0 ? Math.round((input.pageViews / denominator) * 100) : 0
  const ctaRate = input.pageViews > 0 ? Math.round((input.ctaClicks / input.pageViews) * 100) : 0
  const bookingRate = input.pageViews > 0 ? Math.round((input.bookingCompletes / input.pageViews) * 100) : 0
  const completionRate =
    input.videoStarts > 0 ? Math.round((input.videoCompletes / input.videoStarts) * 100) : 0
  const repeatEngagementRate =
    input.uniqueVisitors > 0 ? Math.round((input.repeatVisitors / input.uniqueVisitors) * 100) : 0

  return { viewRate, ctaRate, bookingRate, completionRate, repeatEngagementRate }
}
