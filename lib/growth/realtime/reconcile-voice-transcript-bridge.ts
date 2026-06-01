import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { bridgeVoiceSegmentToGrowthRealtime } from "@/lib/growth/realtime/voice-transcript-bridge"
import {
  findActiveMediaSessionForCall,
  findActiveTranscriptSessionForMedia,
  listTranscriptSegments,
} from "@/lib/voice/repository/voice-media-streaming-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

async function findLatestMediaSessionForCall(
  admin: SupabaseClient,
  organizationId: string,
  voiceCallId: string,
) {
  const active = await findActiveMediaSessionForCall(admin, organizationId, voiceCallId)
  if (active) return active

  const { data, error } = await admin
    .schema("voice")
    .from("voice_media_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("voice_call_id", voiceCallId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    voiceCallId: String(data.voice_call_id),
  }
}

/**
 * Backfill Growth transcript events from voice segments that missed the live bridge
 * (e.g. coaching session linked after first prospect utterance, or media stream restarted late).
 */
export async function reconcileVoiceTranscriptBridgeForCall(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    realtimeSessionId: string
  },
): Promise<{ bridgedCount: number; skippedCount: number }> {
  const mediaSession = await findLatestMediaSessionForCall(admin, input.organizationId, input.voiceCallId)
  if (!mediaSession?.id) {
    return { bridgedCount: 0, skippedCount: 0 }
  }

  const transcriptSession = await findActiveTranscriptSessionForMedia(
    admin,
    input.organizationId,
    mediaSession.id,
  )
  if (!transcriptSession) {
    const { data: latestTranscriptSession } = await admin
      .schema("voice")
      .from("voice_transcript_sessions")
      .select("id")
      .eq("media_session_id", mediaSession.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latestTranscriptSession?.id) {
      return { bridgedCount: 0, skippedCount: 0 }
    }
    return reconcileSegments(admin, {
      ...input,
      transcriptSessionId: latestTranscriptSession.id as string,
    })
  }

  return reconcileSegments(admin, {
    ...input,
    transcriptSessionId: transcriptSession.id,
  })
}

async function reconcileSegments(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceCallId: string
    realtimeSessionId: string
    transcriptSessionId: string
  },
): Promise<{ bridgedCount: number; skippedCount: number }> {
  const { data: existingRows } = await admin
    .schema("growth")
    .from("realtime_call_transcript_events")
    .select("source_voice_segment_id")
    .eq("session_id", input.realtimeSessionId)

  const bridgedSegmentIds = new Set(
    (existingRows ?? [])
      .map((row) => row.source_voice_segment_id as string | null)
      .filter((value): value is string => Boolean(value)),
  )

  const segments = await listTranscriptSegments(admin, {
    organizationId: input.organizationId,
    transcriptSessionId: input.transcriptSessionId,
  })

  let bridgedCount = 0
  let skippedCount = 0

  for (const segment of segments) {
    if (bridgedSegmentIds.has(segment.id) || !segment.transcriptText.trim()) {
      skippedCount += 1
      continue
    }

    const result = await bridgeVoiceSegmentToGrowthRealtime(admin, {
      voiceCallId: input.voiceCallId,
      transcriptSegmentId: segment.id,
      sequenceNumber: segment.sequenceNumber,
      speakerType: segment.speakerType,
      transcriptText: segment.transcriptText,
      startedAt: segment.startedAt,
    })

    if (result.bridged) {
      bridgedCount += 1
      bridgedSegmentIds.add(segment.id)
    } else {
      skippedCount += 1
    }
  }

  if (bridgedCount > 0) {
    logVoiceInfrastructure("voice_growth_transcript_bridge_reconciled", {
      voiceCallId: input.voiceCallId,
      realtimeSessionId: input.realtimeSessionId,
      bridgedCount,
      skippedCount,
    })
  }

  return { bridgedCount, skippedCount }
}
