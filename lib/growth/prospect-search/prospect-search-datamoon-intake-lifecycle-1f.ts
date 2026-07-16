/**
 * GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F — Durable intake lifecycle helpers (client-safe).
 */

export const GROWTH_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER =
  "ge-aios-portfolio-intake-pending-state-1f-v1" as const

export type AutonomousRunIntakeLifecycleFields = {
  /** True when provider run completed and survivors await portfolio promotion. */
  intake_pending?: boolean
  intake_pending_at?: string | null
  /** True after portfolio manager finishes promotion batch for this run. */
  intake_completed?: boolean
  intake_completed_at?: string | null
  /** Set when promotion batch begins — idempotency witness for concurrent ticks. */
  intake_promotion_started_at?: string | null
}

export type AutonomousRunIntakeLifecycleState =
  | "provider_active"
  | "intake_pending"
  | "intake_completed"
  | "provider_failed"
  | "provider_completed_untracked"

export function resolveAutonomousRunIntakeLifecycleState(input: {
  runStatus: string
  intake: AutonomousRunIntakeLifecycleFields
}): AutonomousRunIntakeLifecycleState {
  if (input.intake.intake_completed === true) return "intake_completed"
  if (input.runStatus === "failed") return "provider_failed"
  if (input.runStatus === "pending_build" || input.runStatus === "building") {
    return "provider_active"
  }
  if (
    input.intake.intake_pending === true ||
    (isCompletedProviderStatus(input.runStatus) && input.intake.intake_completed !== true)
  ) {
    return "intake_pending"
  }
  if (isCompletedProviderStatus(input.runStatus)) return "provider_completed_untracked"
  return "provider_active"
}

export function isCompletedProviderStatus(status: string): boolean {
  return status === "completed" || status === "imported" || status === "imported_partial"
}

/** Completed autonomous run eligible for intake resume (tenant-neutral legacy orphan rule). */
export function isRunEligibleForIntakePromotion(input: {
  runStatus: string
  intake: AutonomousRunIntakeLifecycleFields
}): boolean {
  if (!isCompletedProviderStatus(input.runStatus)) return false
  if (input.intake.intake_completed === true) return false
  return true
}

export const PORTFOLIO_INTAKE_IDEMPOTENCY_DESIGN = {
  survivorPromotion:
    "createLeadCandidate dedupe_hash + intent_session_id — duplicate ticks yield already_exists, not duplicate leads",
  runTerminalization:
    "intake_completed persisted on run metadata after promotion batch — subsequent ticks skip run via findLatestIntakePending",
  intakePendingWitness:
    "intake_pending set on provider completion with survivors — legacy completed runs without flag remain eligible until intake_completed",
  concurrentTicks:
    "Multiple ticks may push the same run; lead dedupe + intake_completed metadata make the batch exactly-once at run level",
} as const
