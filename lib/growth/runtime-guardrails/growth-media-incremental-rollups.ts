/** GS-RG-1 — incremental media rollup computation (client-safe). */

import type { GrowthMediaAssetEventRow } from "@/lib/growth/media/media-asset-analytics-types"
import type { GrowthMediaPlaybackAnalyticsEventType } from "@/lib/growth/media/media-asset-analytics-types"

export type IncrementalMediaRollupState = {
  views: number
  uniqueViews: number
  playStarts: number
  completions: number
  ctaClicks: number
  totalWatchSeconds: number
  watchSessionCount: number
  completionRate: number
  averageWatchSeconds: number
  lastEventAt: string | null
}

export type IncrementalMediaRollupDelta = Partial<IncrementalMediaRollupState> & {
  isNewUniqueView?: boolean
  isNewWatchSession?: boolean
  watchSecondsDelta?: number
}

export function emptyIncrementalMediaRollupState(): IncrementalMediaRollupState {
  return {
    views: 0,
    uniqueViews: 0,
    playStarts: 0,
    completions: 0,
    ctaClicks: 0,
    totalWatchSeconds: 0,
    watchSessionCount: 0,
    completionRate: 0,
    averageWatchSeconds: 0,
    lastEventAt: null,
  }
}

export function computeIncrementalMediaRollupDelta(
  event: Pick<
    GrowthMediaAssetEventRow,
    "eventType" | "sessionId" | "progressSeconds" | "eventTimestamp"
  >,
  input?: {
    sessionAlreadyViewed?: boolean
    sessionPriorMaxProgress?: number
  },
): IncrementalMediaRollupDelta {
  const delta: IncrementalMediaRollupDelta = {
    lastEventAt: event.eventTimestamp,
  }

  switch (event.eventType as GrowthMediaPlaybackAnalyticsEventType) {
    case "video_viewed":
      delta.views = 1
      if (!input?.sessionAlreadyViewed) {
        delta.isNewUniqueView = true
        delta.uniqueViews = 1
      }
      break
    case "video_play_started":
      delta.playStarts = 1
      break
    case "video_completed":
      delta.completions = 1
      if (event.progressSeconds != null) {
        const prior = input?.sessionPriorMaxProgress ?? 0
        if (event.progressSeconds > prior) {
          delta.watchSecondsDelta = event.progressSeconds - prior
        }
      }
      break
    case "video_progress":
      if (event.progressSeconds != null) {
        const prior = input?.sessionPriorMaxProgress ?? 0
        if (event.progressSeconds > prior) {
          delta.watchSecondsDelta = event.progressSeconds - prior
          if (prior === 0) delta.isNewWatchSession = true
        }
      }
      break
    case "video_cta_clicked":
      delta.ctaClicks = 1
      break
    default:
      break
  }

  return delta
}

export function applyIncrementalMediaRollupDelta(
  state: IncrementalMediaRollupState,
  delta: IncrementalMediaRollupDelta,
): IncrementalMediaRollupState {
  const views = state.views + (delta.views ?? 0)
  const uniqueViews = state.uniqueViews + (delta.uniqueViews ?? 0)
  const playStarts = state.playStarts + (delta.playStarts ?? 0)
  const completions = state.completions + (delta.completions ?? 0)
  const ctaClicks = state.ctaClicks + (delta.ctaClicks ?? 0)

  let watchSessionCount = state.watchSessionCount + (delta.isNewWatchSession ? 1 : 0)
  let totalWatchSeconds = state.totalWatchSeconds + (delta.watchSecondsDelta ?? 0)

  if (delta.isNewWatchSession && watchSessionCount === 0) {
    watchSessionCount = 1
  }

  const completionRate = playStarts > 0 ? Math.min(1, completions / playStarts) : 0
  const averageWatchSeconds =
    watchSessionCount > 0 ? totalWatchSeconds / watchSessionCount : state.averageWatchSeconds

  return {
    views,
    uniqueViews,
    playStarts,
    completions,
    ctaClicks,
    totalWatchSeconds,
    watchSessionCount,
    completionRate,
    averageWatchSeconds,
    lastEventAt: delta.lastEventAt ?? state.lastEventAt,
  }
}

export type VideoPageRollupDelta = {
  views?: number
  uniqueViewers?: number
  completions?: number
  ctaClicks?: number
  watchPercentDelta?: number
  isNewWatchSession?: boolean
  lastEventAt?: string | null
}

export function applyVideoPageRollupDelta(
  state: {
    views: number
    uniqueViewers: number
    completions: number
    ctaClicks: number
    totalWatchPercentSum: number
    watchSessionCount: number
    avgWatchPercent: number
    lastEventAt: string | null
  },
  delta: VideoPageRollupDelta,
): typeof state {
  const watchSessionCount = state.watchSessionCount + (delta.isNewWatchSession ? 1 : 0)
  const totalWatchPercentSum = state.totalWatchPercentSum + (delta.watchPercentDelta ?? 0)
  const avgWatchPercent =
    watchSessionCount > 0 ? totalWatchPercentSum / watchSessionCount : state.avgWatchPercent

  return {
    views: state.views + (delta.views ?? 0),
    uniqueViewers: state.uniqueViewers + (delta.uniqueViewers ?? 0),
    completions: state.completions + (delta.completions ?? 0),
    ctaClicks: state.ctaClicks + (delta.ctaClicks ?? 0),
    totalWatchPercentSum,
    watchSessionCount,
    avgWatchPercent: Math.min(100, Math.max(0, avgWatchPercent)),
    lastEventAt: delta.lastEventAt ?? state.lastEventAt,
  }
}

export function mapVideoPageEventToRollupDelta(
  eventType: string,
  input?: { sessionAlreadySeen?: boolean; watchPercent?: number; priorWatchPercent?: number },
): VideoPageRollupDelta {
  const delta: VideoPageRollupDelta = {}
  switch (eventType) {
    case "page_viewed":
      delta.views = 1
      if (!input?.sessionAlreadySeen) delta.uniqueViewers = 1
      break
    case "video_completed":
      delta.completions = 1
      break
    case "cta_clicked":
      delta.ctaClicks = 1
      break
    case "video_progress": {
      const current = input?.watchPercent ?? 0
      const prior = input?.priorWatchPercent ?? 0
      if (current > prior) {
        delta.watchPercentDelta = current - prior
        if (prior === 0) delta.isNewWatchSession = true
      }
      break
    }
    default:
      break
  }
  return delta
}
