import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { syncLiveGuidanceForSession } from "@/lib/growth/live-guidance/sync-live-guidance"
import {
  appendGrowthRealtimeTranscriptEvent,
  listGrowthRealtimeTranscriptEvents,
  updateGrowthRealtimeCallSession,
} from "@/lib/growth/realtime/realtime-call-repository"
import type { GrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-types"
import { toGrowthLeadRealtimeIntelligenceInput } from "@/lib/growth/realtime/realtime-lead-intelligence"
import { analyzeRealtimeCallTranscript } from "@/lib/growth/realtime/realtime-session-analyzer"
import { computeTranscriptQualityScore } from "@/lib/growth/realtime/providers/transcript-quality"
import type { RealtimeTranscriptChunk } from "@/lib/growth/realtime/providers/provider-types"
import { fetchGrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/live-coaching-settings-repository"

type SessionStreamState = {
  confidenceTotal: number
  finalChunkCount: number
  keywordHits: number
  speakerLabelsPresent: boolean
}

const streamState = new Map<string, SessionStreamState>()

export async function ingestRealtimeProviderTranscriptChunk(
  admin: SupabaseClient,
  input: {
    session: GrowthRealtimeCallSession
    chunk: RealtimeTranscriptChunk
    actor?: { userId: string | null; email: string | null }
  },
): Promise<GrowthRealtimeCallSession> {
  const settings = await fetchGrowthLiveCoachingSettings(admin)
  if (!input.chunk.isFinal) return input.session
  if (
    input.chunk.confidence !== undefined &&
    input.chunk.confidence < settings.transcriptConfidenceThreshold
  ) {
    return input.session
  }

  const events = await listGrowthRealtimeTranscriptEvents(admin, input.session.id)
  await appendGrowthRealtimeTranscriptEvent(admin, {
    sessionId: input.session.id,
    speaker: input.chunk.speaker,
    content: input.chunk.content,
    sequenceNumber: events.length,
    timestampMs: input.chunk.timestampMs,
  })

  const metrics = streamState.get(input.session.id) ?? {
    confidenceTotal: 0,
    finalChunkCount: 0,
    keywordHits: 0,
    speakerLabelsPresent: false,
  }
  metrics.finalChunkCount += 1
  metrics.confidenceTotal += input.chunk.confidence ?? settings.transcriptConfidenceThreshold
  if ((input.chunk.keywords?.length ?? 0) > 0) metrics.keywordHits += 1
  if (input.chunk.speaker === "rep" || input.chunk.speaker === "prospect") {
    metrics.speakerLabelsPresent = true
  }
  streamState.set(input.session.id, metrics)

  const lead = await fetchGrowthLeadById(admin, input.session.leadId)
  if (!lead) throw new Error("not_found")
  const nextEvents = await listGrowthRealtimeTranscriptEvents(admin, input.session.id)
  const snapshot = analyzeRealtimeCallTranscript({
    events: nextEvents,
    lead: toGrowthLeadRealtimeIntelligenceInput(lead),
  })

  const guidanceStarted = Date.now()
  const coachingState = await syncLiveGuidanceForSession(admin, {
    leadId: input.session.leadId,
    sessionId: input.session.id,
    snapshot,
    events: nextEvents,
    lead: toGrowthLeadRealtimeIntelligenceInput(lead),
    actor: input.actor,
  })

  const transcriptQualityScore = computeTranscriptQualityScore({
    finalChunkCount: metrics.finalChunkCount,
    averageConfidence:
      metrics.finalChunkCount > 0 ? metrics.confidenceTotal / metrics.finalChunkCount : 0,
    keywordHitRate: metrics.finalChunkCount > 0 ? metrics.keywordHits / metrics.finalChunkCount : 0,
    speakerSeparationEnabled: settings.speakerSeparationEnabled,
    speakerLabelsPresent: metrics.speakerLabelsPresent,
  })

  return updateGrowthRealtimeCallSession(admin, input.session.id, {
    liveSnapshot: snapshot,
    transcriptQualityScore,
    guidanceLatencyMs: coachingState.guidanceLatencyMs || Date.now() - guidanceStarted,
  })
}

export function clearRealtimeProviderStreamState(sessionId: string) {
  streamState.delete(sessionId)
}
