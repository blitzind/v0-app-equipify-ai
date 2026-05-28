/** Outbound approval workflow — Phase 5A. No autonomous initiation. */

import type {
  OutboundApprovalAction,
  VoiceAiOutboundSessionStatus,
} from "@/lib/voice/ai-outbound/types"

export type OutboundApprovalTransitionResult = {
  status: VoiceAiOutboundSessionStatus
  supervisionMode: "approval_required" | "operator_supervised" | "operator_joined"
}

export function canApplyOutboundApproval(
  action: OutboundApprovalAction,
  currentStatus: VoiceAiOutboundSessionStatus,
): boolean {
  if (action === "approve") {
    return currentStatus === "pending_operator_approval" || currentStatus === "queued"
  }
  if (action === "reject" || action === "cancel") {
    return (
      currentStatus === "pending_operator_approval" ||
      currentStatus === "queued" ||
      currentStatus === "initiating"
    )
  }
  if (action === "schedule") {
    return currentStatus === "pending_operator_approval" || currentStatus === "queued"
  }
  return false
}

export function applyOutboundApprovalTransition(
  action: OutboundApprovalAction,
): OutboundApprovalTransitionResult | null {
  switch (action) {
    case "approve":
      return { status: "queued", supervisionMode: "operator_supervised" }
    case "schedule":
      return { status: "queued", supervisionMode: "operator_supervised" }
    case "reject":
      return { status: "canceled", supervisionMode: "approval_required" }
    case "cancel":
      return { status: "canceled", supervisionMode: "approval_required" }
    default:
      return null
  }
}

export function canInitiateOutboundSession(status: VoiceAiOutboundSessionStatus): boolean {
  return status === "queued"
}

export function canOperatorTakeover(status: VoiceAiOutboundSessionStatus): boolean {
  return status === "active" || status === "escalation_pending" || status === "voicemail_mode" || status === "initiating"
}
