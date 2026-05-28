/** Bounded outbound qualification — Phase 5A. */

export type OutboundQualificationStep = {
  key: string
  prompt: string
  required: boolean
}

export const DEFAULT_OUTBOUND_QUALIFICATION_STEPS: OutboundQualificationStep[] = [
  { key: "service_type", prompt: "What type of service or equipment is this regarding?", required: true },
  { key: "urgency", prompt: "How urgent is this — today, this week, or flexible?", required: true },
  { key: "callback_preference", prompt: "What is the best callback time if we need to follow up?", required: false },
]

export function getCurrentOutboundQualificationStep(
  steps: OutboundQualificationStep[],
  stepIndex: number,
): OutboundQualificationStep | null {
  return steps[stepIndex] ?? null
}

export function isOutboundQualificationComplete(
  steps: OutboundQualificationStep[],
  state: Record<string, unknown>,
): boolean {
  const required = steps.filter((s) => s.required)
  return required.every((step) => {
    const val = state[step.key]
    return typeof val === "string" && val.trim().length > 0
  })
}

export function applyOutboundQualificationAnswer(
  state: Record<string, unknown>,
  stepKey: string,
  answer: string,
): Record<string, unknown> {
  return { ...state, [stepKey]: answer.trim() }
}

export function classifyUrgency(text: string): "high" | "medium" | "low" | "unknown" {
  const lower = text.toLowerCase()
  if (/\b(today|now|emergency|urgent|asap|down|broken)\b/.test(lower)) return "high"
  if (/\b(this week|soon|priority)\b/.test(lower)) return "medium"
  if (/\b(flexible|no rush|whenever)\b/.test(lower)) return "low"
  return "unknown"
}
