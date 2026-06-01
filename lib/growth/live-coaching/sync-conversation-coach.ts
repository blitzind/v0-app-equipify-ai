/** Sync conversation coach turn on transcript updates. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyConversationStage } from "@/lib/growth/live-coaching/conversation-stage-engine"
import { generateLlmCoachTurn } from "@/lib/growth/live-coaching/llm-turn-coach"
import type { ConversationCoachTurn, ConversationStage } from "@/lib/growth/live-coaching/types"
import {
  buildInboundBootstrapCoachTurn,
  buildOutboundBootstrapCoachTurn,
  generateDeterministicCoachTurn,
} from "@/lib/growth/live-coaching/turn-coach-generator"
import {
  lastCustomerFacingSequence,
  lastProspectTranscriptEvent,
  shouldRefreshCoachForCustomerSpeech,
} from "@/lib/growth/live-coaching/prospect-turn-detection"
import { updateGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"

export type ConversationCoachSyncResult = {
  coachTurn: ConversationCoachTurn
  stage: ConversationStage
  stageObjective: string
  liveSnapshot: GrowthRealtimeLiveSnapshot
}

function shouldRefreshCoachTurn(input: {
  events: GrowthRealtimeTranscriptEvent[]
  previousCoach: ConversationCoachTurn | null | undefined
}): boolean {
  return shouldRefreshCoachForCustomerSpeech(input)
}

function refreshDecisionReason(input: {
  events: GrowthRealtimeTranscriptEvent[]
  previousCoach: ConversationCoachTurn | null | undefined
}): string {
  if (input.events.length === 0) return "no_events"
  const lastCustomerSeq = lastCustomerFacingSequence(input.events, input.previousCoach)
  if (lastCustomerSeq === null) return "no_customer_facing_sequence"
  if (!input.previousCoach) return "no_previous_coach"
  if (input.previousCoach.triggeredBySequenceNumber === null) return "bootstrap_active"
  if (lastCustomerSeq > input.previousCoach.triggeredBySequenceNumber) return "new_customer_sequence"
  return "sequence_not_advanced"
}

export async function syncConversationCoach(input: {
  session: GrowthRealtimeCallSession
  events: GrowthRealtimeTranscriptEvent[]
  snapshot: GrowthRealtimeLiveSnapshot
  direction?: "inbound" | "outbound" | null
  organizationId?: string | null
  preferLlm?: boolean
}): Promise<ConversationCoachSyncResult> {
  const previousCoach = input.session.liveSnapshot.conversationCoach ?? input.snapshot.conversationCoach ?? null
  const stageResult = classifyConversationStage({
    events: input.events,
    snapshot: input.snapshot,
    previousStage: previousCoach?.stage ?? null,
  })

  let coachTurn = previousCoach
  const lastProspectTurn = lastProspectTranscriptEvent(input.events)

  logVoiceInfrastructure("coach_turn_trace", {
    sessionId: input.session.id,
    eventCount: input.events.length,
    lastProspectSequence: lastProspectTurn?.sequenceNumber ?? null,
    lastProspectSpeaker: lastProspectTurn?.speaker ?? null,
    previousCoachSource: previousCoach?.source ?? null,
    previousCoachTriggeredBySequenceNumber: previousCoach?.triggeredBySequenceNumber ?? null,
  })

  if (!coachTurn) {
    coachTurn =
      input.direction === "inbound" ? buildInboundBootstrapCoachTurn() : buildOutboundBootstrapCoachTurn()
  }

  const shouldRefresh = shouldRefreshCoachTurn({ events: input.events, previousCoach: coachTurn })
  logVoiceInfrastructure("coach_turn_refresh_decision", {
    sessionId: input.session.id,
    shouldRefreshCoachTurn: shouldRefresh,
    reason: refreshDecisionReason({ events: input.events, previousCoach: coachTurn }),
    lastProspectSequence: lastProspectTurn?.sequenceNumber ?? null,
    previousCoachTriggeredBySequenceNumber: coachTurn.triggeredBySequenceNumber,
  })

  if (shouldRefresh) {
    const deterministic = generateDeterministicCoachTurn({
      events: input.events,
      stage: stageResult.stage,
      snapshot: input.snapshot,
      inbound: input.direction === "inbound",
      previousCoach: coachTurn,
    })

    let nextTurn = deterministic
    let generationSource: "deterministic" | "llm" = "deterministic"
    if (input.preferLlm !== false && input.organizationId && input.events.length > 0) {
      const llmTurn = await generateLlmCoachTurn({
        organizationId: input.organizationId,
        events: input.events,
        stage: stageResult.stage,
        stageObjective: stageResult.stageObjective,
        snapshot: input.snapshot,
        inbound: input.direction === "inbound",
        previousCoach: coachTurn,
      }).catch(() => null)
      if (llmTurn) {
        nextTurn = llmTurn
        generationSource = "llm"
      }
    }

    logVoiceInfrastructure("coach_turn_generated", {
      sessionId: input.session.id,
      generationSource,
      primaryPhrase: nextTurn.primaryPhrase,
      triggeredBySequenceNumber: nextTurn.triggeredBySequenceNumber,
      stage: stageResult.stage,
    })

    coachTurn = {
      ...nextTurn,
      stage: stageResult.stage,
      stageObjective: stageResult.stageObjective,
    }
  } else if (coachTurn) {
    coachTurn = {
      ...coachTurn,
      stage: stageResult.stage,
      stageObjective: stageResult.stageObjective,
    }
  }

  const liveSnapshot: GrowthRealtimeLiveSnapshot = {
    ...input.snapshot,
    conversationCoach: coachTurn,
    recommendedNextQuestion: coachTurn.primaryPhrase,
    recommendedResponse: coachTurn.rationale,
  }

  logVoiceInfrastructure("coach_turn_persisted", {
    sessionId: input.session.id,
    source: coachTurn.source,
    primaryPhrase: coachTurn.primaryPhrase,
    triggeredBySequenceNumber: coachTurn.triggeredBySequenceNumber,
    updatedAt: coachTurn.updatedAt,
  })

  return {
    coachTurn,
    stage: stageResult.stage,
    stageObjective: stageResult.stageObjective,
    liveSnapshot,
  }
}

export async function persistConversationCoach(
  admin: SupabaseClient,
  input: {
    sessionId: string
    liveSnapshot: GrowthRealtimeLiveSnapshot
  },
): Promise<GrowthRealtimeCallSession> {
  return updateGrowthRealtimeCallSession(admin, input.sessionId, {
    liveSnapshot: input.liveSnapshot,
  })
}

export async function bootstrapConversationCoachForSession(
  admin: SupabaseClient,
  input: {
    session: GrowthRealtimeCallSession
    direction: "inbound" | "outbound"
  },
): Promise<ConversationCoachTurn> {
  const coachTurn =
    input.direction === "inbound" ? buildInboundBootstrapCoachTurn() : buildOutboundBootstrapCoachTurn()
  const liveSnapshot: GrowthRealtimeLiveSnapshot = {
    ...input.session.liveSnapshot,
    conversationCoach: coachTurn,
    recommendedNextQuestion: coachTurn.primaryPhrase,
    recommendedResponse: coachTurn.rationale,
  }
  await updateGrowthRealtimeCallSession(admin, input.session.id, { liveSnapshot })
  return coachTurn
}
