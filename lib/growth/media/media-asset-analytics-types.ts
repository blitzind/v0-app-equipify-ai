/** Growth Engine media analytics types (S1.5 hooks + S2-D playback events). */

export const GROWTH_MEDIA_PLAYBACK_ANALYTICS_QA_MARKER = "growth-media-playback-analytics-s2d-v1" as const

export const GROWTH_MEDIA_ANALYTICS_MIGRATION = "20270827120800_growth_media_asset_analytics_s2d.sql" as const

/** S1.5 hook-only event names — interfaces only; no events emitted in S1.5. */
export const GROWTH_MEDIA_ANALYTICS_EVENT_TYPES = [
  "view",
  "play",
  "completion",
  "clickthrough",
  "download",
] as const

export type GrowthMediaAnalyticsEventType = (typeof GROWTH_MEDIA_ANALYTICS_EVENT_TYPES)[number]

/** S2-D persisted playback analytics event types. */
export const GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES = [
  "video_viewed",
  "video_play_started",
  "video_progress",
  "video_completed",
  "video_paused",
  "video_replayed",
  "video_cta_clicked",
] as const

export type GrowthMediaPlaybackAnalyticsEventType =
  (typeof GROWTH_MEDIA_PLAYBACK_ANALYTICS_EVENT_TYPES)[number]

export const DEFAULT_MEDIA_PLAYBACK_COMPLETION_THRESHOLD = 0.9 as const

export const DEFAULT_MEDIA_PLAYBACK_PROGRESS_DEBOUNCE_MS = 2000 as const

export type GrowthMediaPlaybackAnalyticsSafetyFlags = {
  no_public_playback: true
  no_autonomous_tracking_without_token: true
  no_notifications: true
  no_sequence_execution: true
  no_ai_generation: true
}

export const GROWTH_MEDIA_PLAYBACK_ANALYTICS_SAFETY_FLAGS: GrowthMediaPlaybackAnalyticsSafetyFlags = {
  no_public_playback: true,
  no_autonomous_tracking_without_token: true,
  no_notifications: true,
  no_sequence_execution: true,
  no_ai_generation: true,
}

export type GrowthMediaAnalyticsEventPayload = {
  assetId: string
  organizationId: string
  eventType: GrowthMediaAnalyticsEventType
  relationshipType?: string | null
  relationshipId?: string | null
  sessionId?: string | null
  progressSeconds?: number | null
  completionPercent?: number | null
  destinationUrl?: string | null
  metadata?: Record<string, unknown>
  occurredAt?: string
}

export type GrowthMediaPlaybackAnalyticsIngestInput = {
  organizationId: string
  assetId: string
  eventType: GrowthMediaPlaybackAnalyticsEventType
  sessionId: string
  trackingToken?: string | null
  ingestSource?: "platform_admin" | "client_hook"
  relationshipId?: string | null
  leadId?: string | null
  sharePageId?: string | null
  templateId?: string | null
  sequenceId?: string | null
  anonymousIdHash?: string | null
  progressSeconds?: number | null
  progressPercent?: number | null
  durationSeconds?: number | null
  ctaKey?: string | null
  metadata?: Record<string, unknown>
  eventTimestamp?: string
}

export type GrowthMediaAssetEventRow = {
  id: string
  organizationId: string
  assetId: string
  relationshipId: string | null
  eventType: GrowthMediaPlaybackAnalyticsEventType
  leadId: string | null
  sharePageId: string | null
  templateId: string | null
  sequenceId: string | null
  sessionId: string
  anonymousIdHash: string | null
  eventTimestamp: string
  progressSeconds: number | null
  progressPercent: number | null
  durationSeconds: number | null
  ctaKey: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthMediaAssetEventRollup = {
  assetId: string
  organizationId: string
  views: number
  uniqueViews: number
  playStarts: number
  completions: number
  completionRate: number
  averageWatchSeconds: number
  ctaClicks: number
  lastEventAt: string | null
  updatedAt: string
}

export type GrowthMediaAnalyticsAggregate = {
  assetId: string
  views: number
  plays: number
  completions: number
  clickthroughs: number
  downloads: number
}

/** Placeholder interface for future analytics ingestion — S1.5 does not emit events. */
export interface GrowthMediaAnalyticsRecorder {
  recordEvent(payload: GrowthMediaAnalyticsEventPayload): Promise<void>
}

export type GrowthMediaPlaybackAnalyticsHookOptions = {
  assetId: string
  trackingToken?: string | null
  enabled?: boolean
  analyticsPreviewMode?: boolean
  durationSeconds?: number | null
  completionThreshold?: number
  progressDebounceMs?: number
  relationshipId?: string | null
  sharePageId?: string | null
  templateId?: string | null
  leadId?: string | null
}
