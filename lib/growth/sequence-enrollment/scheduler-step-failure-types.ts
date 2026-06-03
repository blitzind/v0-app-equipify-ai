/** Client-safe scheduler step failure types (standalone transport + AI draft generation). */

export const GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES = [
  "ai_not_configured",
  "ai_provider_unavailable",
  "ai_org_missing_or_invalid",
  "missing_lead_context",
  "personalization_failed",
  "generation_insert_failed",
  "unknown_generation_error",
  "copilot_disabled",
  "rule_blocked",
] as const

export type GrowthSchedulerAiGenerationFailureCode =
  (typeof GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES)[number]

export type GrowthSequenceSchedulerStepFailurePhase =
  | "scheduler_preflight"
  | "ai_generation"
  | "queue_preflight"
  | "queue_other"

export type GrowthSequenceSchedulerStepFailureProviderHealth = {
  ok: boolean
  provider?: string
  message?: string | null
}

export type GrowthSequenceSchedulerStepFailure = {
  enrollmentId: string
  stepId: string
  leadId: string
  generationType?: string | null
  code: string
  message: string
  phase: GrowthSequenceSchedulerStepFailurePhase
  providerHealth?: GrowthSequenceSchedulerStepFailureProviderHealth | null
}

const AI_GENERATION_FAILURE_COPY: Record<string, string> = {
  ai_not_configured: "AI copilot is not configured for draft generation.",
  ai_provider_unavailable: "AI provider is unavailable — check platform AI routing and provider health.",
  ai_org_missing_or_invalid:
    "GROWTH_ENGINE_AI_ORG_ID is missing or not a valid UUID — draft generation cannot run.",
  missing_lead_context: "Lead context required for draft generation was not found.",
  personalization_failed: "Outreach personalization failed before the draft could be created.",
  generation_insert_failed: "Draft content was produced but could not be saved to the database.",
  unknown_generation_error: "Draft generation failed for an unknown reason.",
  copilot_disabled: "AI Copilot is disabled in platform settings.",
  rule_blocked: "Copilot governance rules blocked draft generation for this lead.",
  reputation_blocked: "Send preflight blocked scheduling — deliverability or reputation protection.",
  capacity_blocked: "Operational capacity rules blocked outreach for this lead.",
  preflight_blocked: "Outreach preflight blocked scheduling for this step.",
  lead_not_found: "Lead record was not found for this sequence step.",
}

export function isGrowthSchedulerAiGenerationFailureCode(
  code: string,
): code is GrowthSchedulerAiGenerationFailureCode {
  return (GROWTH_SCHEDULER_AI_GENERATION_FAILURE_CODES as readonly string[]).includes(code)
}

export function normalizeGrowthSchedulerAiGenerationFailureCode(input: {
  code: string
  message?: string | null
}): string {
  const message = input.message ?? ""
  if (input.code === "ai_not_configured" && /GROWTH_ENGINE_AI_ORG_ID/i.test(message)) {
    return "ai_org_missing_or_invalid"
  }
  if (input.code === "lead_not_found") return "missing_lead_context"
  if (input.code === "ai_not_configured" && /unavailable|provider/i.test(message)) {
    return "ai_provider_unavailable"
  }
  return input.code
}

export function formatGrowthSchedulerStepFailureMessage(
  failure: Pick<GrowthSequenceSchedulerStepFailure, "code" | "message">,
): string {
  const normalized = normalizeGrowthSchedulerAiGenerationFailureCode(failure)
  const base =
    AI_GENERATION_FAILURE_COPY[normalized] ??
    AI_GENERATION_FAILURE_COPY[failure.code] ??
    AI_GENERATION_FAILURE_COPY.unknown_generation_error

  const detail = failure.message?.trim()
  if (!detail || detail === base) return base
  if (base.includes(detail)) return base
  return `${base} (${detail})`
}

export function pickSchedulerStepFailureForEnrollment(input: {
  stepFailures: GrowthSequenceSchedulerStepFailure[] | undefined
  enrollmentId: string
  stepId?: string | null
}): GrowthSequenceSchedulerStepFailure | null {
  const failures = input.stepFailures ?? []
  if (failures.length === 0) return null

  if (input.stepId) {
    const exact = failures.find(
      (failure) => failure.enrollmentId === input.enrollmentId && failure.stepId === input.stepId,
    )
    if (exact) return exact
  }

  return failures.find((failure) => failure.enrollmentId === input.enrollmentId) ?? null
}
