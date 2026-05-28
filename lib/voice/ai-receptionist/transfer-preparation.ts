/** Transfer and operator takeover preparation — Phase 4A. */

import type { VoiceAiReceptionistSessionPublicView } from "@/lib/voice/ai-receptionist/types"

export type ReceptionistHandoffDraft = {
  summary: string
  callerIntent: string | null
  qualificationCaptured: Record<string, unknown>
  escalationReason: string | null
  recommendedAction: "warm_transfer" | "cold_transfer" | "callback" | "voicemail"
}

export function buildReceptionistHandoffDraft(input: {
  session: VoiceAiReceptionistSessionPublicView
  callerIntent: string | null
  recentTranscript: string[]
}): ReceptionistHandoffDraft {
  const qual = sessionQualificationLines(input.session.qualificationState)
  const transcriptSnippet = input.recentTranscript.slice(-4).join(" | ")

  let recommendedAction: ReceptionistHandoffDraft["recommendedAction"] = "warm_transfer"
  if (input.session.receptionistStatus === "voicemail_capture") recommendedAction = "voicemail"
  else if (input.session.escalationRiskLevel === "critical") recommendedAction = "warm_transfer"
  else if (qual.length === 0) recommendedAction = "callback"

  const summary = [
    "AI receptionist handoff (operator review required):",
    input.callerIntent ? `Intent: ${input.callerIntent.replace(/_/g, " ")}.` : null,
    qual.length ? `Qualification: ${qual.join("; ")}.` : "Qualification: partial or not started.",
    transcriptSnippet ? `Recent caller context: ${transcriptSnippet}.` : null,
    input.session.escalationRiskLevel !== "low"
      ? `Escalation risk: ${input.session.escalationRiskLevel}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    summary,
    callerIntent: input.callerIntent,
    qualificationCaptured: input.session.qualificationState,
    escalationReason:
      input.session.receptionistStatus === "escalated" || input.session.receptionistStatus === "transfer_pending"
        ? "Caller requested human or topic requires escalation."
        : null,
    recommendedAction,
  }
}

function sessionQualificationLines(state: Record<string, unknown>): string[] {
  return Object.entries(state)
    .filter(([, v]) => typeof v === "string" && v.trim())
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v)}`)
}

export function buildMissedCallRecoveryHook(input: {
  voiceCallId: string
  callerNumber: string
  handoff: ReceptionistHandoffDraft
}): Record<string, unknown> {
  return {
    hook: "missed_call_recovery_prepared",
    voiceCallId: input.voiceCallId,
    callerNumber: input.callerNumber,
    callbackRecommended: true,
    summary: input.handoff.summary,
    autonomousOutboundDisabled: true,
    preparedAt: new Date().toISOString(),
  }
}
