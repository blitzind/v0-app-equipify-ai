/** Apollo Full Pipeline Production Certification types — client-safe. */

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER =
  "apollo-full-pipeline-production-certification-v1" as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID =
  "apollo-full-pipeline-production-certification-v1" as const

export const APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN = [
  "Apollo",
  "Qualification",
  "Enrollment",
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
  voice_drop_candidate_id: string | null
  multichannel_sequence_candidate_id: string | null
  sequence_execution_candidate_id: string | null
  sequence_enrollment_id: string | null
  growth_lead_id: string | null
}

export type ApolloFullPipelineProductionCertificationReport = {
  qa_marker: typeof APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER
  certification_id: typeof APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID
  execution_id: string
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  stage_ids: ApolloFullPipelineStageIds
  attribution_chain: ApolloFullPipelineAttributionStage[]
  attribution_preserved: boolean
  safety: ApolloFullPipelineSafetyFlags
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
