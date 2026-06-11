/** Apollo Full Pipeline Production Certification types — client-safe. */

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER =
  "apollo-full-pipeline-production-certification-v1" as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID =
  "apollo-full-pipeline-production-certification-v1" as const

export const APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
] as const

export type ApolloFullPipelineAttributionStage =
  (typeof APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN)[number]

export type ApolloFullPipelineSafetyFlags = {
  outreach_sent: false
  jobs_scheduled: false
  email_sent: false
  sms_sent: false
  voice_drop_sent: false
  call_placed: false
  draft_created: true
}

export type ApolloFullPipelineStageIds = {
  company_candidate_id: string
  enrollment_candidate_id: string | null
  account_playbook_id: string | null
  voice_drop_candidate_id: string | null
  multichannel_sequence_candidate_id: string | null
  sequence_execution_candidate_id: string | null
  sequence_enrollment_id: string | null
  growth_lead_id: string | null
}

export type ApolloFullPipelineQualificationThresholdSource = "production" | "certification_override"

export type ApolloFullPipelineMaterializationEvidence = {
  materialization_attempted: boolean
  materialization_error: string | null
  materialization_error_table: string | null
  materialization_error_operation: string | null
  sequence_execution_candidate_id: string | null
  sequence_enrollment_id: string | null
  steps_created: number
  draft_placeholders_created: number
  pending_approval_jobs_created: number
  selected_sequence_key: string | null
  selected_sequence_template: string | null
  unsupported_channel_or_template_blockers: string[]
  materialization_reused: boolean
  growth_lead_resolution_attempted: boolean
  growth_lead_resolution_source: string | null
  growth_lead_id: string | null
  growth_lead_id_before: string | null
  growth_lead_id_after: string | null
  growth_lead_backfilled_rows: string[]
  growth_lead_resolution_blockers: string[]
  certification_sequence_template_override_used: boolean
  original_sequence_key: string | null
  materialized_sequence_key: string | null
  materializable_steps_before: number
  materializable_steps_after: number
  template_override_blockers: string[]
}

export type ApolloFullPipelineSafetyViolation = {
  stage: string
  field: string
  value: unknown
}

export type ApolloFullPipelineEnrollmentEvidence = {
  sequence_ready_contact_id: string | null
  sequence_ready_contact_name: string | null
  selected_contact_name: string | null
  growth_lead_id: string | null
  company_contact_id: string | null
  contact_candidate_id: string | null
  qualification_score: number | null
  qualification_threshold: number | null
  qualification_threshold_source: ApolloFullPipelineQualificationThresholdSource | null
  production_threshold: number | null
  certification_threshold: number | null
  qualification_override_used: boolean
  qualification_blockers: string[]
  existing_enrollment_candidate_id: string | null
  existing_enrollment_candidate_status: string | null
  duplicate_prevention_decision: string | null
  insert_error: string | null
  db_error_table: string | null
  db_error_operation: string | null
  db_error_message: string | null
  certification_source: string | null
  automation_message: string | null
}

export type ApolloFullPipelineProductionCertificationReport = {
  qa_marker: typeof APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER
  certification_id: typeof APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID
  execution_id: string
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  enrollment_evidence: ApolloFullPipelineEnrollmentEvidence | null
  materialization_evidence: ApolloFullPipelineMaterializationEvidence | null
  stage_ids: ApolloFullPipelineStageIds
  attribution_chain: ApolloFullPipelineAttributionStage[]
  attribution_preserved: boolean
  safety: ApolloFullPipelineSafetyFlags
  safety_violations: ApolloFullPipelineSafetyViolation[]
  readiness_checklist: string[]
  rollback_notes: string[]
  summary: string
  completed_at: string
}

export type ApolloFullPipelineProductionCertificationExecuteResult = {
  ok: boolean
  execution_id: string
  certification: ApolloFullPipelineProductionCertificationReport | null
  blockers: string[]
  error?: "gates_failed" | "company_not_found" | "certification_failed"
  message?: string | null
}
