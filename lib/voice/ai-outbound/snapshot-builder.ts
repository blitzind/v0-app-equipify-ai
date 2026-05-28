/** Outbound AI snapshot builders — Phase 5A. */

import type {
  VoiceAiOutboundApprovalQueueSnapshot,
  VoiceAiOutboundEventPublicView,
  VoiceAiOutboundSessionPublicView,
  VoiceAiOutboundWorkspaceSnapshot,
} from "@/lib/voice/ai-outbound/types"
import { VOICE_AI_OUTBOUND_QA_MARKER } from "@/lib/voice/ai-outbound/types"

export function buildOutboundApprovalQueueSnapshot(input: {
  pendingSessions: VoiceAiOutboundSessionPublicView[]
  blockedCount: number
}): VoiceAiOutboundApprovalQueueSnapshot {
  return {
    qaMarker: VOICE_AI_OUTBOUND_QA_MARKER,
    generatedAt: new Date().toISOString(),
    pendingSessions: input.pendingSessions,
    blockedCount: input.blockedCount,
    pendingApprovalCount: input.pendingSessions.filter(
      (s) => s.outboundSessionStatus === "pending_operator_approval" || s.outboundSessionStatus === "queued",
    ).length,
    message: "Outbound AI requires operator approval before initiation. Autonomous cold calling disabled.",
  }
}

export function buildOutboundWorkspaceSnapshot(input: {
  activeSessions: VoiceAiOutboundSessionPublicView[]
  recentEvents: VoiceAiOutboundEventPublicView[]
  pendingApprovalCount: number
}): VoiceAiOutboundWorkspaceSnapshot {
  return {
    qaMarker: VOICE_AI_OUTBOUND_QA_MARKER,
    generatedAt: new Date().toISOString(),
    activeSessions: input.activeSessions,
    recentEvents: input.recentEvents,
    pendingApprovalCount: input.pendingApprovalCount,
    autonomousOutboundDisabled: true,
    approvalRequired: true,
    message: "Supervised AI outbound — bounded conversations with compliance gating and operator oversight.",
  }
}
