import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapVoiceSpeakerToGrowthRealtime } from "@/lib/growth/realtime/voice-speaker-mapper"
import {
  fetchGrowthRealtimeCallSession,
  appendGrowthRealtimeTranscriptEventFromVoiceSegment,
  findActiveRealtimeSessionIdForVoiceCall,
} from "@/lib/growth/realtime/realtime-call-repository"
import { recomputeGrowthRealtimeCallSession } from "@/lib/growth/realtime/run-realtime-call-session"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export type BridgeVoiceSegmentInput = {
  voiceCallId: string
  transcriptSegmentId: string
  sequenceNumber: number
  speakerType: string
  transcriptText: string
  startedAt?: string | null
}

export type BridgeVoiceSegmentResult = {
  bridged: boolean
  duplicate: boolean
  realtimeSessionId: string | null
  reason?: string
}

function resolveTimestampMs(startedAt?: string | null): number {
  if (!startedAt) return Date.now()
  const parsed = Date.parse(startedAt)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

export async function bridgeVoiceSegmentToGrowthRealtime(
  admin: SupabaseClient,
  input: BridgeVoiceSegmentInput,
): Promise<BridgeVoiceSegmentResult> {
  const transcriptText = input.transcriptText.trim()
  if (!transcriptText) {
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "empty_transcript" }
  }

  const realtimeSessionId = await findActiveRealtimeSessionIdForVoiceCall(admin, input.voiceCallId)
  if (!realtimeSessionId) {
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "no_active_coaching_session" }
  }

  const session = await fetchGrowthRealtimeCallSession(admin, realtimeSessionId)
  if (!session) {
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "session_not_found" }
  }
  if (session.status === "completed" || session.status === "discarded") {
    return {
      bridged: false,
      duplicate: false,
      realtimeSessionId,
      reason: "session_closed",
    }
  }

  const appendResult = await appendGrowthRealtimeTranscriptEventFromVoiceSegment(admin, {
    sessionId: realtimeSessionId,
    sourceVoiceSegmentId: input.transcriptSegmentId,
    speaker: mapVoiceSpeakerToGrowthRealtime(input.speakerType),
    content: transcriptText,
    timestampMs: resolveTimestampMs(input.startedAt),
  })

  if (appendResult.duplicate) {
    return { bridged: false, duplicate: true, realtimeSessionId }
  }

  await recomputeGrowthRealtimeCallSession(admin, realtimeSessionId)

  logVoiceInfrastructure("voice_growth_transcript_bridged", {
    voiceCallId: input.voiceCallId,
    realtimeSessionId,
    transcriptSegmentId: input.transcriptSegmentId,
    sequenceNumber: appendResult.event.sequenceNumber,
  })

  return { bridged: true, duplicate: false, realtimeSessionId }
}
