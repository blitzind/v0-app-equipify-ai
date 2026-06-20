/** SR-3 Phase 4 — attributed sequence wake event types (client-safe). */

import type { GrowthSharePageEventType } from "@/lib/growth/share-pages/share-page-types"
import type { GrowthMediaPlaybackAnalyticsEventType } from "@/lib/growth/media/media-asset-analytics-types"
import type {
  SequenceConditionEvent,
  SequenceConditionSource,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"

export const GROWTH_SEQUENCE_EVENT_WAKE_QA_MARKER =
  "growth-sequence-event-wake-sr3-phase4-v1" as const

export type SequenceAttributedWakeEvent = {
  leadId: string
  sequenceEnrollmentId?: string | null
  sequenceEnrollmentStepId?: string | null
  source: SequenceConditionSource
  event: SequenceConditionEvent
  evidenceRef?: string | null
  occurredAt?: string
}

export type SequenceEventWakeResult = {
  scannedWaits: number
  resolvedWaits: number
  blockedWaits: number
  skippedWaits: number
  wakeCursor?: string | null
  processedCount?: number
  remainingCount?: number
  wakeExecutionEnabled?: boolean
  truncated?: boolean
}

const SHARE_PAGE_WAKE_MAP: Partial<Record<GrowthSharePageEventType, SequenceConditionEvent>> = {
  SHARE_PAGE_VIEWED: "share_page.viewed",
  SHARE_PAGE_CTA_CLICKED: "share_page.cta_clicked",
  SHARE_PAGE_BOOKING_STARTED: "share_page.booking_started",
  SHARE_PAGE_BOOKING_COMPLETED: "share_page.booking_completed",
}

const MEDIA_PLAYBACK_WAKE_MAP: Partial<
  Record<GrowthMediaPlaybackAnalyticsEventType, SequenceConditionEvent>
> = {
  video_viewed: "media.viewed",
  video_play_started: "media.play_started",
  video_completed: "media.completed",
  video_cta_clicked: "media.cta_clicked",
}

export function mapSharePageEventToSequenceWakeEvent(
  eventType: GrowthSharePageEventType,
): SequenceConditionEvent | null {
  if (eventType in SHARE_PAGE_WAKE_MAP) {
    return SHARE_PAGE_WAKE_MAP[eventType] ?? null
  }
  return null
}

export function mapMediaPlaybackEventToSequenceWakeEvent(
  eventType: GrowthMediaPlaybackAnalyticsEventType,
): SequenceConditionEvent | null {
  if (eventType in MEDIA_PLAYBACK_WAKE_MAP) {
    return MEDIA_PLAYBACK_WAKE_MAP[eventType] ?? null
  }
  return null
}

export function buildSequenceAttributedWakeEvent(
  input: SequenceAttributedWakeEvent,
): SequenceAttributedWakeEvent {
  return {
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId ?? null,
    sequenceEnrollmentStepId: input.sequenceEnrollmentStepId ?? null,
    source: input.source,
    event: input.event,
    evidenceRef: input.evidenceRef ?? null,
    occurredAt: input.occurredAt,
  }
}
