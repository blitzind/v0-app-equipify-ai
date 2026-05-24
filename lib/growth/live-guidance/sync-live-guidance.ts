import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateLiveGuidanceCandidates, pickSuggestedNextQuestion } from "@/lib/growth/live-guidance/live-guidance-engine"
import {
  countAcceptedLiveGuidanceForSession,
  insertLiveGuidanceEvent,
  listActiveLiveGuidanceEvents,
  updateLiveGuidanceEventAction,
} from "@/lib/growth/live-guidance/live-guidance-repository"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import {
  computeCallExecutionScore,
  computeLiveMomentum,
  computeLiveRiskLevel,
} from "@/lib/growth/live-guidance/live-execution-score"
import type {
  GrowthLeadRealtimeIntelligenceInput,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import {
  emitGrowthLeadLiveGuidanceGeneratedTimeline,
  emitGrowthLeadLiveGuidanceUsedTimeline,
} from "@/lib/growth/timeline-emitter"

type Actor = { userId: string | null; email: string | null }

export async function syncLiveGuidanceForSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    snapshot: GrowthRealtimeLiveSnapshot
    events: GrowthRealtimeTranscriptEvent[]
    lead: GrowthLeadRealtimeIntelligenceInput
    organizationId?: string | null
    actor?: Actor
  },
): Promise<GrowthLiveCoachingState> {
  const candidates = generateLiveGuidanceCandidates({
    snapshot: input.snapshot,
    events: input.events,
    lead: input.lead,
  })

  const active = await listActiveLiveGuidanceEvents(admin, input.sessionId)
  const activeTypes = new Set(active.map((event) => event.eventType))

  for (const candidate of candidates) {
    if (activeTypes.has(candidate.eventType)) continue
    const inserted = await insertLiveGuidanceEvent(admin, {
      organizationId: input.organizationId ?? null,
      leadId: input.leadId,
      sessionId: input.sessionId,
      candidate,
    })
    activeTypes.add(candidate.eventType)
    if (input.actor) {
      await emitGrowthLeadLiveGuidanceGeneratedTimeline(admin, {
        leadId: input.leadId,
        sessionId: input.sessionId,
        guidanceId: inserted.id,
        title: inserted.title,
        actor: input.actor,
      })
    }
  }

  const activeGuidance = await listActiveLiveGuidanceEvents(admin, input.sessionId)
  const acceptedCount = await countAcceptedLiveGuidanceForSession(admin, input.sessionId)
  const executionScore = computeCallExecutionScore({
    snapshot: input.snapshot,
    events: input.events,
    acceptedGuidanceCount: acceptedCount,
  })

  return {
    executionScore,
    suggestedNextQuestion: pickSuggestedNextQuestion({ snapshot: input.snapshot, candidates }),
    riskLevel: computeLiveRiskLevel(input.snapshot),
    momentum: computeLiveMomentum(input.snapshot),
    activeGuidance: activeGuidance,
  }
}

export async function dismissLiveGuidanceEvent(
  admin: SupabaseClient,
  input: { eventId: string; leadId: string; sessionId: string },
) {
  return updateLiveGuidanceEventAction(admin, input.eventId, "dismiss")
}

export async function acceptLiveGuidanceEvent(
  admin: SupabaseClient,
  input: {
    eventId: string
    leadId: string
    sessionId: string
    actor?: Actor
  },
) {
  const updated = await updateLiveGuidanceEventAction(admin, input.eventId, "accept")
  if (input.actor) {
    await emitGrowthLeadLiveGuidanceUsedTimeline(admin, {
      leadId: input.leadId,
      sessionId: input.sessionId,
      guidanceId: updated.id,
      title: updated.title,
      actor: input.actor,
    })
  }
  return updated
}
