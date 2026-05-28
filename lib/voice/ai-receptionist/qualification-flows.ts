/** Bounded qualification flows — Phase 4A. */

import type {
  VoiceAiReceptionistQualificationFlowPublicView,
  VoiceAiReceptionistQualificationStep,
} from "@/lib/voice/ai-receptionist/types"

export const DEFAULT_QUALIFICATION_STEPS: VoiceAiReceptionistQualificationStep[] = [
  { key: "company_name", prompt: "May I have your company name?", required: true },
  { key: "service_type", prompt: "What type of service or equipment do you need help with?", required: true },
  { key: "urgency", prompt: "How urgent is this — today, this week, or flexible?", required: true },
  { key: "callback_preference", prompt: "What is the best callback number and time?", required: false },
]

export function buildDefaultQualificationFlow(organizationId: string): Omit<
  VoiceAiReceptionistQualificationFlowPublicView,
  "id"
> {
  return {
    organizationId,
    flowKey: "inbound_default",
    label: "Inbound default qualification",
    steps: DEFAULT_QUALIFICATION_STEPS,
    escalationTriggers: ["emergency", "speak_to_human", "legal_advice"],
    isActive: true,
  }
}

export function getCurrentQualificationStep(
  flow: VoiceAiReceptionistQualificationFlowPublicView,
  stepIndex: number,
): VoiceAiReceptionistQualificationStep | null {
  return flow.steps[stepIndex] ?? null
}

export function isQualificationComplete(
  flow: VoiceAiReceptionistQualificationFlowPublicView,
  state: Record<string, unknown>,
): boolean {
  const required = flow.steps.filter((s) => s.required)
  return required.every((step) => {
    const val = state[step.key]
    return typeof val === "string" && val.trim().length > 0
  })
}

export function applyQualificationAnswer(
  state: Record<string, unknown>,
  stepKey: string,
  answer: string,
): Record<string, unknown> {
  return { ...state, [stepKey]: answer.trim() }
}

export function qualificationProgress(
  flow: VoiceAiReceptionistQualificationFlowPublicView,
  state: Record<string, unknown>,
): { completed: number; total: number; currentStep: string | null } {
  const required = flow.steps.filter((s) => s.required)
  const completed = required.filter((step) => {
    const val = state[step.key]
    return typeof val === "string" && val.trim().length > 0
  }).length
  const nextStep = flow.steps.find((step) => {
    const val = state[step.key]
    return !(typeof val === "string" && val.trim().length > 0)
  })
  return {
    completed,
    total: required.length,
    currentStep: nextStep?.key ?? null,
  }
}
