import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { syncLiveGuidanceForSession } from "@/lib/growth/live-guidance/sync-live-guidance"
import { resolveNativeCallDirectionForRealtimeSession } from "@/lib/growth/live-coaching/resolve-call-direction"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
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
import { computeCallExecutionScore } from "@/lib/growth/live-guidance/live-execution-score"
import {
  emitLiveCoachingSnapshotDiffTimeline,
  emitLiveCoachingTranscriptChunkTimeline,
} from "@/lib/growth/realtime/live-coaching/session-timeline-emitter"

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
    latencyMs?: number
  },
): Promise<GrowthRealtimeCallSession> {
  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const existingEvents = await listGrowthRealtimeTranscriptEvents(admin, input.session.id)
  await emitLiveCoachingTranscriptChunkTimeline(admin, input.session, {
    sequenceNumber: existingEvents.length,
    speaker: input.chunk.speaker,
    isFinal: input.chunk.isFinal,
    latencyMs: input.latencyMs,
    confidence: input.chunk.confidence,
  })

  if (!input.chunk.isFinal) return input.session
  if (
    input.chunk.confidence !== undefined &&
    input.chunk.confidence < settings.transcriptConfidenceThreshold
  ) {
    return input.session
  }

  const events = existingEvents
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
  const previousSnapshot = input.session.liveSnapshot
  const previousExecutionScore = computeCallExecutionScore({
    snapshot: previousSnapshot,
    events,
  }).score
  const nextEvents = await listGrowthRealtimeTranscriptEvents(admin, input.session.id)
  const snapshot = analyzeRealtimeCallTranscript({
    events: nextEvents,
    lead: toGrowthLeadRealtimeIntelligenceInput(lead),
  })

  const guidanceStarted = Date.now()
  const organizationId = getGrowthEngineAiOrgId()
  const direction = await resolveNativeCallDirectionForRealtimeSession(admin, input.session.id).catch(() => null)
  const synced = await syncLiveGuidanceForSession(admin, {
    leadId: input.session.leadId,
    sessionId: input.session.id,
    snapshot,
    events: nextEvents,
    lead: toGrowthLeadRealtimeIntelligenceInput(lead),
    organizationId,
    direction,
    session: input.session,
    actor: input.actor,
  })
  const coachingState = synced.coachingState
  const enrichedSnapshot = synced.liveSnapshot

  const transcriptQualityScore = computeTranscriptQualityScore({
    finalChunkCount: metrics.finalChunkCount,
    averageConfidence:
      metrics.finalChunkCount > 0 ? metrics.confidenceTotal / metrics.finalChunkCount : 0,
    keywordHitRate: metrics.finalChunkCount > 0 ? metrics.keywordHits / metrics.finalChunkCount : 0,
    speakerSeparationEnabled: settings.speakerSeparationEnabled,
    speakerLabelsPresent: metrics.speakerLabelsPresent,
  })

  await emitLiveCoachingSnapshotDiffTimeline(admin, {
    session: input.session,
    previousSnapshot,
    nextSnapshot: enrichedSnapshot,
    events: nextEvents,
    previousExecutionScore,
  })

  return updateGrowthRealtimeCallSession(admin, input.session.id, {
    liveSnapshot: enrichedSnapshot,
    transcriptQualityScore,
    guidanceLatencyMs: coachingState.guidanceLatencyMs || Date.now() - guidanceStarted,
  })
}

export function clearRealtimeProviderStreamState(sessionId: string) {
  streamState.delete(sessionId)
}
