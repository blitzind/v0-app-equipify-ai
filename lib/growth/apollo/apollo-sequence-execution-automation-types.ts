/** Apollo Sequence Execution Automation types — client-safe. */

import type { GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"
import type { ApolloOrchestrationChannelId } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"

export const APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER =
  "apollo-sequence-execution-automation-v1" as const

export const APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID =
  "apollo-sequence-execution-automation-v1" as const

export const APOLLO_SEQUENCE_EXECUTION_CANDIDATE_STATUSES = [
  "pending_draft_approval",
  "execution_ready",
  "draft_rejected",
  "draft_regenerated",
] as const

export type ApolloSequenceExecutionCandidateStatus =
  (typeof APOLLO_SEQUENCE_EXECUTION_CANDIDATE_STATUSES)[number]

export const APOLLO_SEQUENCE_EXECUTION_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
] as const

export type ApolloSequenceExecutionSourceAttribution =
  (typeof APOLLO_SEQUENCE_EXECUTION_SOURCE_ATTRIBUTION)[number]

export type ApolloSequenceExecutionDraftType = "email" | "sms" | "voice_drop" | "call"

export type ApolloSequenceExecutionDraftApprovalStatus =
  | "pending_draft_approval"
  | "draft_approved"
  | "draft_rejected"

export type ApolloSequenceExecutionStepPlan = {
  step_number: number
  channel: GrowthSequenceStepChannel
  orchestration_channel: ApolloOrchestrationChannelId
  scheduled_offset_days: number
  scheduled_for_label: string
  generation_type: string | null
  approval_status: ApolloSequenceExecutionDraftApprovalStatus
  pattern_step_key: string | null
}

export type ApolloSequenceExecutionDraftRecord = {
  draft_id: string
  draft_type: ApolloSequenceExecutionDraftType
  step_number: number
  channel: GrowthSequenceStepChannel
  subject_placeholder: string | null
  body_placeholder: string
  voice_drop_script_reference: string | null
  approval_status: ApolloSequenceExecutionDraftApprovalStatus
  content_summary: string
}

export type ApolloSequenceExecutionMaterializationPlan = {
  plan_version: string
  sequence_key: string
  sequence_label: string
  pattern_key: string
  total_steps: number
  total_days: number
  steps: ApolloSequenceExecutionStepPlan[]
  drafts: ApolloSequenceExecutionDraftRecord[]
}

export type ApolloSequenceExecutionJobLink = {
  step_number: number
  sequence_step_id: string | null
  execution_job_id: string | null
  channel: GrowthSequenceStepChannel
  job_status: string
  scheduled_for: string | null
}

export type ApolloSequenceExecutionAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  voice_drop_source: string
  multichannel_source: string
  sequence_execution_source: string
  attribution_chain: ApolloSequenceExecutionSourceAttribution[]
}

export type ApolloSequenceExecutionOperatorSummary = {
  why_materialized: string
  sequence_label: string
  step_summary: string
  draft_summary: string
  execution_queue_summary: string
}

export type ApolloSequenceExecutionCandidateRow = {
  candidate_id: string
  multichannel_sequence_candidate_id: string
  voice_drop_candidate_id: string
  enrollment_candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  growth_lead_id: string | null
  sequence_enrollment_id: string | null
  status: ApolloSequenceExecutionCandidateStatus
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualification_score: number
  materialization: ApolloSequenceExecutionMaterializationPlan
  execution_jobs: ApolloSequenceExecutionJobLink[]
  source_attribution: ApolloSequenceExecutionAttributionRecord
  operator_summary: ApolloSequenceExecutionOperatorSummary
  created_at: string
  drafts_approved_at: string | null
  drafts_approved_email: string | null
}

export type ApolloSequenceExecutionQueueSnapshot = {
  qa_marker: typeof APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER
  queue_label: "Sequence Execution Queue"
  items: ApolloSequenceExecutionCandidateRow[]
  summary: {
    total: number
    pending_drafts: number
    execution_ready: number
    rejected: number
    regenerated: number
  }
  outreach_sent: false
  voice_drop_sent: false
  email_sent: false
  sms_sent: false
  call_placed: false
  draft_created: true
  jobs_scheduled: false
}

export type ApolloSequenceExecutionFunnelMetrics = {
  qa_marker: typeof APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER
  approved_sequences: number
  generated_sequences: number
  generated_drafts: number
  approved_drafts: number
  rejected_drafts: number
  execution_ready_sequences: number
  channel_mix: Record<string, number>
  computed_at: string
}

export type ApolloSequenceExecutionAutomationActionResult = {
  ok: boolean
  action:
    | "create_from_multichannel"
    | "approve_draft"
    | "reject_draft"
    | "regenerate_draft"
  candidate_id: string | null
  candidate_ids: string[]
  status: ApolloSequenceExecutionCandidateStatus | null
  error?: string | null
  sequence_enrollment_id?: string | null
  steps_created?: number
  draft_placeholders_created?: number
  pending_approval_jobs_created?: number
  materialization_reused?: boolean
  outreach_sent: false
  voice_drop_sent: false
  email_sent: false
  sms_sent: false
  call_placed: false
  draft_created: true
  jobs_scheduled: false
}

export type ApolloSequenceExecutionAutomationReport = {
  qa_marker: typeof APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER
  automation_id: typeof APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID
  execution_id: string
  multichannel_sequence_candidate_id: string | null
  candidates_created: number
  candidates_skipped_duplicate: number
  funnel_metrics: ApolloSequenceExecutionFunnelMetrics
  candidates: ApolloSequenceExecutionCandidateRow[]
  blockers: string[]
  outreach_sent: false
  voice_drop_sent: false
  email_sent: false
  sms_sent: false
  call_placed: false
  draft_created: true
  jobs_scheduled: false
  completed_at: string
}

export type ApolloSequenceExecutionCertificationReport = {
  qa_marker: typeof APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  attribution_preserved: boolean
  duplicate_prevention_verified: boolean
  approval_flow_verified: boolean
  sequence_generation_verified: boolean
  draft_generation_verified: boolean
  execution_queue_verified: boolean
  safety: {
    outreach_sent: false
    voice_drop_sent: false
    email_sent: false
    sms_sent: false
    call_placed: false
    draft_created: true
    jobs_scheduled: false
  }
  funnel_metrics: ApolloSequenceExecutionFunnelMetrics | null
  summary: string
}

export type ApolloSequenceExecutionMultichannelHandoffInput = {
  multichannel_sequence_candidate_id: string
  voice_drop_candidate_id: string
  enrollment_candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  growth_lead_id: string | null
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualification_score: number
  sequence_key: string
  sequence_label: string
  channel_order: ApolloOrchestrationChannelId[]
  scheduling_plan: {
    total_days: number
    touches: Array<{
      day_offset: number
      channel: ApolloOrchestrationChannelId
      spacing_days_from_prior: number
      cadence_label: string
      reason: string
    }>
  }
  voice_drop_script_reference?: string | null
  source_attribution: Record<string, unknown>
  operator_intelligence?: Record<string, unknown>
  created_by_user_id?: string | null
}
