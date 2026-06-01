import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ensureInboundCallWorkspaceLiveCoachingLinked } from "@/lib/growth/native-dialer/call-workspace-coaching-service"
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

export type VoiceGrowthTranscriptBridgeOutcome =
  | "bridged"
  | "duplicate"
  | "no_active_coaching_session"
  | "insert_failed"
  | "empty_transcript"
  | "session_not_found"
  | "session_closed"

function resolveTimestampMs(startedAt?: string | null): number {
  if (!startedAt) return Date.now()
  const parsed = Date.parse(startedAt)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function logBridgeOutcome(
  outcome: VoiceGrowthTranscriptBridgeOutcome,
  details: Record<string, unknown>,
): void {
  logVoiceInfrastructure("voice_growth_transcript_bridge_outcome", {
    outcome,
    ...details,
  })
}

export async function bridgeVoiceSegmentToGrowthRealtime(
  admin: SupabaseClient,
  input: BridgeVoiceSegmentInput,
): Promise<BridgeVoiceSegmentResult> {
  const baseDetails = {
    voiceCallId: input.voiceCallId,
    transcriptSegmentId: input.transcriptSegmentId,
    sequenceNumber: input.sequenceNumber,
  }

  const transcriptText = input.transcriptText.trim()
  if (!transcriptText) {
    logBridgeOutcome("empty_transcript", baseDetails)
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "empty_transcript" }
  }

  await ensureInboundCallWorkspaceLiveCoachingLinked(admin, { voiceCallId: input.voiceCallId })

  const realtimeSessionId = await findActiveRealtimeSessionIdForVoiceCall(admin, input.voiceCallId)
  if (!realtimeSessionId) {
    logBridgeOutcome("no_active_coaching_session", baseDetails)
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "no_active_coaching_session" }
  }

  const session = await fetchGrowthRealtimeCallSession(admin, realtimeSessionId)
  if (!session) {
    logBridgeOutcome("session_not_found", { ...baseDetails, realtimeSessionId })
    return { bridged: false, duplicate: false, realtimeSessionId: null, reason: "session_not_found" }
  }
  if (session.status === "completed" || session.status === "discarded") {
    logBridgeOutcome("session_closed", { ...baseDetails, realtimeSessionId, sessionStatus: session.status })
    return {
      bridged: false,
      duplicate: false,
      realtimeSessionId,
      reason: "session_closed",
    }
  }

  let appendResult: Awaited<ReturnType<typeof appendGrowthRealtimeTranscriptEventFromVoiceSegment>>
  try {
    appendResult = await appendGrowthRealtimeTranscriptEventFromVoiceSegment(admin, {
      sessionId: realtimeSessionId,
      sourceVoiceSegmentId: input.transcriptSegmentId,
      speaker: mapVoiceSpeakerToGrowthRealtime(input.speakerType),
      content: transcriptText,
      timestampMs: resolveTimestampMs(input.startedAt),
    })
  } catch (error) {
    logBridgeOutcome("insert_failed", {
      ...baseDetails,
      realtimeSessionId,
      message: error instanceof Error ? error.message : String(error),
    })
    return { bridged: false, duplicate: false, realtimeSessionId, reason: "insert_failed" }
  }

  if (appendResult.duplicate) {
    logBridgeOutcome("duplicate", {
      ...baseDetails,
      realtimeSessionId,
      growthSequenceNumber: appendResult.event.sequenceNumber,
    })
    return { bridged: false, duplicate: true, realtimeSessionId }
  }

  await recomputeGrowthRealtimeCallSession(admin, realtimeSessionId)

  logBridgeOutcome("bridged", {
    ...baseDetails,
    realtimeSessionId,
    growthSequenceNumber: appendResult.event.sequenceNumber,
  })

  return { bridged: true, duplicate: false, realtimeSessionId }
}
