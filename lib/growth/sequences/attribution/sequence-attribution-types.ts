/** SR-3 Phase 0 — sequence event attribution (client-safe). */

export const GROWTH_SEQUENCE_ATTRIBUTION_QA_MARKER = "growth-sequence-attribution-sr3-phase0-v1" as const

export const GROWTH_SEQUENCE_ATTRIBUTION_MIGRATION =
  "20270616120100_growth_sequence_attribution_sr3_phase0.sql" as const

export const GROWTH_SEQUENCE_ATTRIBUTION_CONFIRM = "RUN_GROWTH_SEQUENCE_ATTRIBUTION_CERTIFICATION" as const

/** Canonical chain: enrollment → enrollment step → execution job. */
export type GrowthSequenceAttributionContext = {
  sequenceEnrollmentId: string | null
  sequenceEnrollmentStepId: string | null
  sequenceExecutionJobId: string | null
}

export type GrowthSequenceAttributionDbRow = {
  sequence_enrollment_id?: string | null
  sequence_enrollment_step_id?: string | null
  sequence_execution_job_id?: string | null
}

export type GrowthSharePageAttributionDbRow = {
  enrollment_id?: string | null
  sequence_enrollment_step_id?: string | null
  sequence_step_id?: string | null
  sequence_execution_job_id?: string | null
}

export type SequenceExecutionPauseGateCode =
  | "enrollment_paused"
  | "enrollment_completed"
  | "enrollment_cancelled"
  | "exit_candidate_pending"
  | "enrollment_not_active"

export type SequenceExecutionPauseGateResult = {
  allowed: boolean
  blocked: boolean
  code: SequenceExecutionPauseGateCode | null
  reason: string | null
}
