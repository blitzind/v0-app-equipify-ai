"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DEFAULT_MEDIA_PLAYBACK_COMPLETION_THRESHOLD,
  DEFAULT_MEDIA_PLAYBACK_PROGRESS_DEBOUNCE_MS,
  GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES,
  type GrowthMediaPlaybackAnalyticsEventType,
  type GrowthMediaPlaybackAnalyticsHookOptions,
} from "@/lib/growth/media/media-asset-analytics-types"

type PendingEvent = {
  eventType: GrowthMediaPlaybackAnalyticsEventType
  progressSeconds?: number | null
  progressPercent?: number | null
  ctaKey?: string | null
}

function createPlaybackSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function shouldEmitGrowthMediaPlaybackAnalytics(
  options: Pick<
    GrowthMediaPlaybackAnalyticsHookOptions,
    "enabled" | "analyticsPreviewMode" | "trackingToken" | "assetId"
  >,
): boolean {
  if (options.analyticsPreviewMode) return false
  if (options.enabled === false) return false
  if (!options.assetId.trim()) return false
  if (!options.trackingToken?.trim()) return false
  return true
}

export function useGrowthMediaPlaybackAnalytics(options: GrowthMediaPlaybackAnalyticsHookOptions) {
  const sessionIdRef = useRef<string>(createPlaybackSessionId())
  const completionSentRef = useRef(false)
  const progressTimerRef = useRef<number | null>(null)
  const pendingProgressRef = useRef<PendingEvent | null>(null)
  const [lastEventType, setLastEventType] = useState<GrowthMediaPlaybackAnalyticsEventType | null>(null)
  const [emitBlockedReason, setEmitBlockedReason] = useState<string | null>(null)

  const canEmit = useMemo(
    () =>
      shouldEmitGrowthMediaPlaybackAnalytics({
        assetId: options.assetId,
        enabled: options.enabled,
        analyticsPreviewMode: options.analyticsPreviewMode,
        trackingToken: options.trackingToken,
      }),
    [options.analyticsPreviewMode, options.assetId, options.enabled, options.trackingToken],
  )

  const completionThreshold = options.completionThreshold ?? DEFAULT_MEDIA_PLAYBACK_COMPLETION_THRESHOLD
  const progressDebounceMs = options.progressDebounceMs ?? DEFAULT_MEDIA_PLAYBACK_PROGRESS_DEBOUNCE_MS

  const emitEvent = useCallback(
    async (event: PendingEvent) => {
      if (!canEmit) {
        setEmitBlockedReason(
          options.analyticsPreviewMode
            ? "analytics_preview_mode"
            : !options.trackingToken?.trim()
              ? "tracking_token_required"
              : "analytics_disabled",
        )
        return false
      }

      try {
        const response = await fetch("/api/platform/growth/media-assets/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: options.assetId,
            event_type: event.eventType,
            session_id: sessionIdRef.current,
            tracking_token: options.trackingToken,
            relationship_id: options.relationshipId ?? null,
            lead_id: options.leadId ?? null,
            share_page_id: options.sharePageId ?? null,
            template_id: options.templateId ?? null,
            progress_seconds: event.progressSeconds ?? null,
            progress_percent: event.progressPercent ?? null,
            duration_seconds: options.durationSeconds ?? null,
            cta_key: event.ctaKey ?? null,
            metadata: {
              no_public_playback: true,
              hook: "useGrowthMediaPlaybackAnalytics",
            },
          }),
        })
        if (!response.ok) {
          setEmitBlockedReason("emit_failed")
          return false
        }
        setLastEventType(event.eventType)
        setEmitBlockedReason(null)
        return true
      } catch {
        setEmitBlockedReason("emit_failed")
        return false
      }
    },
    [
      canEmit,
      options.analyticsPreviewMode,
      options.assetId,
      options.durationSeconds,
      options.leadId,
      options.relationshipId,
      options.sharePageId,
      options.templateId,
      options.trackingToken,
    ],
  )

  const flushProgress = useCallback(async () => {
    const pending = pendingProgressRef.current
    pendingProgressRef.current = null
    if (!pending) return
    await emitEvent(pending)

    if (
      pending.progressPercent != null &&
      pending.progressPercent / 100 >= completionThreshold &&
      !completionSentRef.current
    ) {
      completionSentRef.current = true
      await emitEvent({
        eventType: "video_completed",
        progressSeconds: pending.progressSeconds,
        progressPercent: pending.progressPercent,
      })
    }
  }, [completionThreshold, emitEvent])

  const queueProgress = useCallback(
    (progressSeconds: number, progressPercent: number) => {
      pendingProgressRef.current = {
        eventType: "video_progress",
        progressSeconds,
        progressPercent,
      }
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current)
      }
      progressTimerRef.current = window.setTimeout(() => {
        void flushProgress()
      }, progressDebounceMs)
    },
    [flushProgress, progressDebounceMs],
  )

  useEffect(() => {
    return () => {
      if (progressTimerRef.current != null) {
        window.clearTimeout(progressTimerRef.current)
      }
    }
  }, [])

  const trackViewed = useCallback(async () => emitEvent({ eventType: "video_viewed" }), [emitEvent])
  const trackPlayStarted = useCallback(async () => emitEvent({ eventType: "video_play_started" }), [emitEvent])
  const trackPaused = useCallback(
    async (progressSeconds: number, progressPercent: number) =>
      emitEvent({ eventType: "video_paused", progressSeconds, progressPercent }),
    [emitEvent],
  )
  const trackReplayed = useCallback(async () => {
    sessionIdRef.current = createPlaybackSessionId()
    completionSentRef.current = false
    return emitEvent({ eventType: "video_replayed" })
  }, [emitEvent])
  const trackCtaClicked = useCallback(
    async (ctaKey: string) => emitEvent({ eventType: "video_cta_clicked", ctaKey }),
    [emitEvent],
  )

  return {
    sessionId: sessionIdRef.current,
    canEmit,
    emitBlockedReason,
    lastEventType,
    supportedEventTypes: GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES,
    trackViewed,
    trackPlayStarted,
    trackProgress: queueProgress,
    trackPaused,
    trackReplayed,
    trackCtaClicked,
  }
}
