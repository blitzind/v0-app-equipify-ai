import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateLiveGuidanceCandidates, pickSuggestedNextQuestion } from "@/lib/growth/live-guidance/live-guidance-engine"
import { planGuidanceSync } from "@/lib/growth/live-guidance/guidance-sync-logic"
import {
  countAcceptedLiveGuidanceForSession,
  insertLiveGuidanceEvent,
  listActiveLiveGuidanceEvents,
  updateLiveGuidanceEventAction,
} from "@/lib/growth/live-guidance/live-guidance-repository"
import type { GrowthLiveCoachingState } from "@/lib/growth/live-guidance/live-guidance-types"
import { rankActiveGuidance } from "@/lib/growth/live-guidance/live-guidance-priority"
import {
  computeCallExecutionScore,
  computeLiveMomentum,
  computeLiveRiskLevel,
} from "@/lib/growth/live-guidance/live-execution-score"
import { syncConversationCoach } from "@/lib/growth/live-coaching/sync-conversation-coach"
import type {
  GrowthLeadRealtimeIntelligenceInput,
  GrowthRealtimeCallSession,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import {
  emitGrowthLeadLiveGuidanceGeneratedTimeline,
  emitGrowthLeadLiveGuidanceUsedTimeline,
} from "@/lib/growth/timeline-emitter"
import { fetchGrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/live-coaching-settings-repository"
import { emitLiveCoachingGuidanceGeneratedTimeline } from "@/lib/growth/realtime/live-coaching/session-timeline-emitter"
import { fetchGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import type { GrowthLiveGuidanceCandidate } from "@/lib/growth/live-guidance/live-guidance-types"

type Actor = { userId: string | null; email: string | null }

function passesGuidanceThreshold(
  candidate: GrowthLiveGuidanceCandidate,
  thresholds: { critical: number; normal: number },
): boolean {
  const minimum = candidate.severity === "high" ? thresholds.critical : thresholds.normal
  return candidate.confidenceScore >= minimum
}

export async function syncLiveGuidanceForSession(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    snapshot: GrowthRealtimeLiveSnapshot
    events: GrowthRealtimeTranscriptEvent[]
    lead: GrowthLeadRealtimeIntelligenceInput
    organizationId?: string | null
    direction?: "inbound" | "outbound" | null
    session?: GrowthRealtimeCallSession | null
    actor?: Actor
  },
): Promise<{ coachingState: GrowthLiveCoachingState; liveSnapshot: GrowthRealtimeLiveSnapshot }> {
  const startedAt = Date.now()
  const session =
    input.session ?? (await fetchGrowthRealtimeCallSession(admin, input.sessionId))

  const coachSync = session
    ? await syncConversationCoach({
        session,
        events: input.events,
        snapshot: input.snapshot,
        direction: input.direction ?? null,
        organizationId: input.organizationId ?? null,
      })
    : null

  const snapshot = coachSync?.liveSnapshot ?? input.snapshot
  const settings = await fetchGrowthLiveCoachingSettings(admin)
  const conversationStage = coachSync?.stage ?? snapshot.conversationCoach?.stage ?? null
  const candidates = generateLiveGuidanceCandidates({
    snapshot,
    events: input.events,
    lead: input.lead,
    conversationStage,
  })

  const passesThreshold = (candidate: GrowthLiveGuidanceCandidate) =>
    passesGuidanceThreshold(candidate, {
      critical: settings.criticalGuidanceThreshold,
      normal: settings.normalGuidanceThreshold,
    })

  const active = await listActiveLiveGuidanceEvents(admin, input.sessionId)
  const actions = planGuidanceSync({
    activeEvents: active,
    candidates,
    passesThreshold,
  })

  for (const action of actions) {
    if (action.type === "dismiss") {
      await updateLiveGuidanceEventAction(admin, action.eventId, "dismiss")
      continue
    }

    const inserted = await insertLiveGuidanceEvent(admin, {
      organizationId: input.organizationId ?? null,
      leadId: input.leadId,
      sessionId: input.sessionId,
      candidate: action.candidate,
    })
    if (input.actor) {
      await emitGrowthLeadLiveGuidanceGeneratedTimeline(admin, {
        leadId: input.leadId,
        sessionId: input.sessionId,
        guidanceId: inserted.id,
        title: inserted.title,
        actor: input.actor,
      })
    }
    const latestSession = await fetchGrowthRealtimeCallSession(admin, input.sessionId)
    if (latestSession) {
      await emitLiveCoachingGuidanceGeneratedTimeline(admin, latestSession, {
        guidanceId: inserted.id,
        guidanceType: inserted.eventType,
        severity: inserted.severity,
      })
    }
  }

  const activeGuidance = await listActiveLiveGuidanceEvents(admin, input.sessionId)
  const acceptedCount = await countAcceptedLiveGuidanceForSession(admin, input.sessionId)
  const executionScore = computeCallExecutionScore({
    snapshot,
    events: input.events,
    acceptedGuidanceCount: acceptedCount,
  })

  const coachingState: GrowthLiveCoachingState = {
    executionScore,
    suggestedNextQuestion: pickSuggestedNextQuestion({ snapshot, candidates }),
    riskLevel: computeLiveRiskLevel(snapshot),
    momentum: computeLiveMomentum(snapshot),
    activeGuidance: rankActiveGuidance(activeGuidance),
    guidanceLatencyMs: Date.now() - startedAt,
    conversationStage: coachSync?.stage ?? snapshot.conversationCoach?.stage ?? null,
    stageObjective: coachSync?.stageObjective ?? snapshot.conversationCoach?.stageObjective ?? null,
    primaryCoach: coachSync?.coachTurn ?? snapshot.conversationCoach ?? null,
  }

  return { coachingState, liveSnapshot: snapshot }
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
