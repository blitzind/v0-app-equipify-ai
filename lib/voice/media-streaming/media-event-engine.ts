import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VoiceMediaTimelineEventType } from "@/lib/voice/media-streaming/types"
import { appendMediaTimelineEvent } from "@/lib/voice/repository/voice-media-streaming-repository"
import { appendVoiceCallEvent } from "@/lib/voice/repository/voice-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import type { VoiceProviderId } from "@/lib/voice/types"

export type MediaEventEngineInput = {
  organizationId: string
  mediaSessionId: string
  voiceCallId: string
  provider: VoiceProviderId
  eventType: VoiceMediaTimelineEventType
  idempotencySuffix: string
  payload?: Record<string, unknown>
  eventTimestamp?: string
}

export async function emitDeterministicMediaEvent(
  admin: SupabaseClient,
  input: MediaEventEngineInput,
): Promise<{ appended: boolean }> {
  const idempotencyKey = `media:${input.mediaSessionId}:${input.eventType}:${input.idempotencySuffix}`
  const timeline = await appendMediaTimelineEvent(admin, {
    organizationId: input.organizationId,
    mediaSessionId: input.mediaSessionId,
    voiceCallId: input.voiceCallId,
    eventType: input.eventType,
    eventTimestamp: input.eventTimestamp,
    idempotencyKey,
    payloadJson: input.payload ?? {},
  })

  if (timeline) {
    await appendVoiceCallEvent(admin, {
      organizationId: input.organizationId,
      voiceCallId: input.voiceCallId,
      provider: input.provider,
      eventType: input.eventType,
      eventTimestamp: timeline.eventTimestamp,
      payloadJson: {
        mediaSessionId: input.mediaSessionId,
        ...input.payload,
      },
      idempotencyKey: `call:${input.voiceCallId}:${input.eventType}:${input.idempotencySuffix}`,
    })
  }

  logVoiceInfrastructure("voice_media_timeline_event", {
    eventType: input.eventType,
    mediaSessionId: input.mediaSessionId,
    appended: Boolean(timeline),
  })

  return { appended: Boolean(timeline) }
}

export const VOICE_MEDIA_TIMELINE_EVENT_LABELS: Record<VoiceMediaTimelineEventType, string> = {
  stream_start: "Media stream started",
  stream_stop: "Media stream stopped",
  participant_join: "Media participant joined",
  participant_leave: "Media participant left",
  stream_reconnect: "Media stream reconnected",
  transcript_segment_append: "Transcript segment appended",
  media_interruption_mark: "Media interruption marker",
}
