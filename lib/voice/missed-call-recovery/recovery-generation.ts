/** Missed-call recovery generation — Phase 4B (deterministic). */

import type {
  VoiceMissedCallRecoveryType,
} from "@/lib/voice/missed-call-recovery/types"

export type RecoveryGenerationInput = {
  recoveryType: VoiceMissedCallRecoveryType
  phoneNumber: string
  callerName?: string | null
  voiceCallId?: string | null
  handoffSummary?: string | null
  afterHours?: boolean
  transferFailed?: boolean
  voicemailLeft?: boolean
  operatorUnavailable?: boolean
  receptionistAbandoned?: boolean
}

export function buildRecoveryEvidenceText(input: RecoveryGenerationInput): string {
  switch (input.recoveryType) {
    case "missed_inbound_call":
      return "Inbound call was not answered — callback recommended (operator-initiated only)."
    case "abandoned_ai_receptionist":
      return "Caller abandoned AI receptionist session before operator takeover."
    case "voicemail_left":
      return "Voicemail left — operator review and callback recommended."
    case "transfer_failed":
      return "Transfer to operator failed — callback recovery recommended."
    case "after_hours_call":
      return "After-hours inbound call — callback during business hours recommended."
    case "no_operator_available":
      return "No operator available to answer — callback recommended."
    default:
      return "Missed-call recovery event — operator follow-up recommended."
  }
}

export function inferRecoveryType(input: Omit<RecoveryGenerationInput, "recoveryType">): VoiceMissedCallRecoveryType {
  if (input.voicemailLeft) return "voicemail_left"
  if (input.receptionistAbandoned) return "abandoned_ai_receptionist"
  if (input.transferFailed) return "transfer_failed"
  if (input.afterHours) return "after_hours_call"
  if (input.operatorUnavailable) return "no_operator_available"
  return "missed_inbound_call"
}

export function buildRecommendedAction(input: RecoveryGenerationInput): string {
  if (input.recoveryType === "voicemail_left") return "review_voicemail_and_callback"
  if (input.recoveryType === "abandoned_ai_receptionist") return "callback_with_handoff_summary"
  if (input.recoveryType === "after_hours_call") return "schedule_callback"
  return "callback"
}

export function defaultCallbackDueAt(recoveryType: VoiceMissedCallRecoveryType, now = new Date()): Date {
  const due = new Date(now)
  if (recoveryType === "after_hours_call") {
    due.setHours(due.getHours() + 12)
  } else if (recoveryType === "voicemail_left") {
    due.setHours(due.getHours() + 2)
  } else {
    due.setHours(due.getHours() + 1)
  }
  return due
}

export function callbackPriorityForRecovery(
  recoveryType: VoiceMissedCallRecoveryType,
): "low" | "normal" | "high" | "urgent" {
  if (recoveryType === "transfer_failed") return "urgent"
  if (recoveryType === "abandoned_ai_receptionist") return "high"
  if (recoveryType === "voicemail_left") return "high"
  if (recoveryType === "after_hours_call") return "normal"
  return "normal"
}
