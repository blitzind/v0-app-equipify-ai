/** Apollo-Primary-5 enrollment confirmation certification types — client-safe. */

export const APOLLO_PRIMARY_5_QA_MARKER = "apollo-primary-contact-enrollment-confirmation-v5" as const

export type ApolloPrimary5CertificationResult = "PASS" | "PASS_PARTIAL" | "FAIL"

export type ApolloPrimary5EnrollmentConfirmationEvidence = {
  lead_id: string
  draft_id: string
  enrollment_id: string
  sequence_pattern_id: string | null
  pattern_id: string | null
  pattern_key: string | null
  enrollment_status: string
  step_count: number
  approval_state: string
  confirmation_executed: boolean
  confirmation_skipped_reason: string | null
  materialize_executed?: boolean
  materialize_skipped_reason?: string | null
}

export type ApolloPrimary5ExecutionReadinessEvidence = {
  visible_in_execution_dashboard: boolean
  visible_in_scheduler: boolean
  execution_jobs_for_enrollment: number
  pending_approval_jobs: number
  execution_blockers: string[]
  approval_requirements: string[]
}

export type ApolloPrimary5ApolloAttributionEvidence = {
  source_chain: string[]
  queue_status: string | null
  draft_audit_status: string | null
  draft_source_attribution: unknown
  queue_metadata_attribution: unknown
  timeline_events: string[]
  lead_active_enrollment_id: string | null
}

export type ApolloPrimary5SafetyEvidence = {
  auto_enrollment: boolean
  outreach_sent: boolean
  apollo_draft_auto_enrollment: boolean | null
  apollo_draft_outreach_sent: boolean | null
  outreach_queue_sent_count: number
  execution_jobs_sent_count: number
  scheduler_runs_triggered: boolean
}

export type ApolloPrimary5DraftVerificationEvidence = {
  draft_exists: boolean
  draft_status: string
  enrollment_status_before_confirm: string
  pattern_attached: boolean
  sequence_recommendation_attached: boolean
  lead_ownership_valid: boolean
  preflight_passed: boolean
  preflight_code: string | null
  suppression_blocked: boolean
  active_enrollment_conflict: boolean
  fatigue_blocked: boolean
  blockers: string[]
}

export type ApolloPrimary5SequenceGenerationEvidence = {
  step_count: number
  step_orders: number[]
  channels: string[]
  step_statuses: string[]
  orphaned_steps: number
  missing_channels: string[]
  invalid_ordering: boolean
}

export type ApolloPrimary5CertificationReport = {
  qa_marker: typeof APOLLO_PRIMARY_5_QA_MARKER
  certification: ApolloPrimary5CertificationResult
  blockers: string[]
  draft_verification: ApolloPrimary5DraftVerificationEvidence
  enrollment_confirmation: ApolloPrimary5EnrollmentConfirmationEvidence
  sequence_generation: ApolloPrimary5SequenceGenerationEvidence
  execution_readiness: ApolloPrimary5ExecutionReadinessEvidence
  apollo_attribution: ApolloPrimary5ApolloAttributionEvidence
  safety: ApolloPrimary5SafetyEvidence
}
