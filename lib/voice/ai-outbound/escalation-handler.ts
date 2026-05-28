/** Outbound escalation + transfer prep — Phase 5A. */

import type { VoiceAiOutboundEscalationState } from "@/lib/voice/ai-outbound/types"

export type OutboundEscalationReason =
  | "operator_requested"
  | "confusion_threshold"
  | "frustration_threshold"
  | "provider_failure"
  | "guardrail_violation"
  | "scheduling_complexity"

export type OutboundEscalationDecision = {
  shouldEscalate: boolean
  reason: OutboundEscalationReason | null
  nextEscalationState: VoiceAiOutboundEscalationState
  handoffSummary: string
}

export function evaluateOutboundEscalation(input: {
  confusionCount: number
  frustrationCount: number
  providerFailed: boolean
  guardrailEscalate: boolean
  operatorRequested: boolean
  schedulingComplex: boolean
  confusionThreshold: number
  frustrationThreshold: number
}): OutboundEscalationDecision {
  if (input.operatorRequested) {
    return {
      shouldEscalate: true,
      reason: "operator_requested",
      nextEscalationState: "operator_requested",
      handoffSummary: "Callee requested a human operator.",
    }
  }
  if (input.providerFailed) {
    return {
      shouldEscalate: true,
      reason: "provider_failure",
      nextEscalationState: "pending",
      handoffSummary: "AI provider failure — operator follow-up required.",
    }
  }
  if (input.guardrailEscalate) {
    return {
      shouldEscalate: true,
      reason: "guardrail_violation",
      nextEscalationState: "pending",
      handoffSummary: "Guardrail triggered escalation.",
    }
  }
  if (input.frustrationCount >= input.frustrationThreshold) {
    return {
      shouldEscalate: true,
      reason: "frustration_threshold",
      nextEscalationState: "pending",
      handoffSummary: "Frustration threshold exceeded.",
    }
  }
  if (input.confusionCount >= input.confusionThreshold) {
    return {
      shouldEscalate: true,
      reason: "confusion_threshold",
      nextEscalationState: "pending",
      handoffSummary: "Repeated confusion detected.",
    }
  }
  if (input.schedulingComplex) {
    return {
      shouldEscalate: true,
      reason: "scheduling_complexity",
      nextEscalationState: "pending",
      handoffSummary: "Scheduling requires human confirmation.",
    }
  }
  return {
    shouldEscalate: false,
    reason: null,
    nextEscalationState: "none",
    handoffSummary: "",
  }
}

export function buildOutboundHandoffSummary(input: {
  workflowType: string
  phoneNumber: string
  qualificationState: Record<string, unknown>
  escalationReason: string | null
}): string {
  const qualKeys = Object.entries(input.qualificationState)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ")
  return [
    `Outbound AI handoff — ${input.workflowType.replace(/_/g, " ")}.`,
    `Phone: ${input.phoneNumber}.`,
    qualKeys ? `Qualification: ${qualKeys}.` : null,
    input.escalationReason ? `Reason: ${input.escalationReason}.` : null,
  ]
    .filter(Boolean)
    .join(" ")
}
