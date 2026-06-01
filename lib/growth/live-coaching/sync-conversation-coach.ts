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
import { updateGrowthRealtimeCallSession } from "@/lib/growth/realtime/realtime-call-repository"
import type {
  GrowthRealtimeCallSession,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"

export type ConversationCoachSyncResult = {
  coachTurn: ConversationCoachTurn
  stage: ConversationStage
  stageObjective: string
  liveSnapshot: GrowthRealtimeLiveSnapshot
}

function lastProspectSequence(events: GrowthRealtimeTranscriptEvent[]): number | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.speaker === "prospect") return events[index]!.sequenceNumber
  }
  return null
}

function shouldRefreshCoachTurn(input: {
  events: GrowthRealtimeTranscriptEvent[]
  previousCoach: ConversationCoachTurn | null | undefined
}): boolean {
  if (input.events.length === 0) return !input.previousCoach
  const lastProspectSeq = lastProspectSequence(input.events)
  if (lastProspectSeq === null) return false
  if (!input.previousCoach) return true
  if (input.previousCoach.triggeredBySequenceNumber === null) return true
  return lastProspectSeq > input.previousCoach.triggeredBySequenceNumber
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

  if (!coachTurn) {
    coachTurn =
      input.direction === "inbound" ? buildInboundBootstrapCoachTurn() : buildOutboundBootstrapCoachTurn()
  }

  if (shouldRefreshCoachTurn({ events: input.events, previousCoach: coachTurn })) {
    const deterministic = generateDeterministicCoachTurn({
      events: input.events,
      stage: stageResult.stage,
      snapshot: input.snapshot,
      inbound: input.direction === "inbound",
    })

    let nextTurn = deterministic
    if (input.preferLlm !== false && input.organizationId && input.events.length > 0) {
      const llmTurn = await generateLlmCoachTurn({
        organizationId: input.organizationId,
        events: input.events,
        stage: stageResult.stage,
        stageObjective: stageResult.stageObjective,
        snapshot: input.snapshot,
        inbound: input.direction === "inbound",
      }).catch(() => null)
      if (llmTurn) nextTurn = llmTurn
    }

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
      updatedAt: new Date().toISOString(),
    }
  }

  const liveSnapshot: GrowthRealtimeLiveSnapshot = {
    ...input.snapshot,
    conversationCoach: coachTurn,
    recommendedNextQuestion: coachTurn.primaryPhrase,
    recommendedResponse: coachTurn.rationale,
  }

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
