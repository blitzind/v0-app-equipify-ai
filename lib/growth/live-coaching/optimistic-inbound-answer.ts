/** Client-safe optimistic coach shown immediately after inbound answer accept. */

import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { ConversationCoachTurn } from "@/lib/growth/live-coaching/types"
import { CONVERSATION_STAGE_OBJECTIVES } from "@/lib/growth/live-coaching/types"

export const OPTIMISTIC_INBOUND_ANSWER_QA_MARKER = "growth-optimistic-inbound-answer-v1" as const

export function buildOptimisticInboundAnswerCoachTurn(): ConversationCoachTurn {
  const now = new Date().toISOString()
  return {
    primaryPhrase: "Thanks for calling — what prompted you to reach out today?",
    rationale: "Inbound call just connected; open with context before discovery.",
    stage: "rapport",
    stageObjective: CONVERSATION_STAGE_OBJECTIVES.rapport,
    evidenceQuote: null,
    triggeredBySequenceNumber: null,
    source: "bootstrap",
    confidence: 0.9,
    updatedAt: now,
  }
}

export function buildOptimisticActiveInboundSession(
  session: NativeCallWorkspaceSessionPublicView,
  connectedAt: string,
): NativeCallWorkspaceSessionPublicView {
  return {
    ...session,
    status: "active",
    connectedAt,
    safeSummary: "Inbound call connected.",
    recordingState: session.recordingState === "pending" ? "active" : session.recordingState,
  }
}
