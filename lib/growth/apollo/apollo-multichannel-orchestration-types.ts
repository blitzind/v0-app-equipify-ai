/** Apollo Multi-Channel Orchestration types — client-safe. */

import type { ApolloChannelAvailability } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"

export const APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER =
  "apollo-multichannel-orchestration-v1" as const

export const APOLLO_MULTICHANNEL_ORCHESTRATION_ID = "apollo-multichannel-orchestration-v1" as const

export const APOLLO_MULTICHANNEL_SEQUENCE_CANDIDATE_STATUSES = [
  "pending_sequence_approval",
  "sequence_approved",
  "sequence_rejected",
  "recommendation_regenerated",
] as const

export type ApolloMultichannelSequenceCandidateStatus =
  (typeof APOLLO_MULTICHANNEL_SEQUENCE_CANDIDATE_STATUSES)[number]

export const APOLLO_MULTICHANNEL_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel Sequence",
] as const

export type ApolloMultichannelSourceAttribution =
  (typeof APOLLO_MULTICHANNEL_SOURCE_ATTRIBUTION)[number]

export type ApolloOrchestrationChannelId =
  | "email"
  | "sms"
  | "voice_drop"
  | "calling"
  | "linkedin"
  | "future_channel"

export type ApolloMultichannelOrchestrationInput = {
  qualification_score: number
  fit_score: number | null
  contact_role: string | null
  company_intelligence_present: boolean
  buying_committee_present: boolean
  available_channels: ApolloChannelAvailability
  channel_confidence: number
  engagement_history_present: boolean
  prior_outreach_count: number
  voice_drop_score: number | null
}

export type ApolloMultichannelOrchestrationResult = {
  recommended_sequence: string
  channel_order: ApolloOrchestrationChannelId[]
  confidence_score: number
  reasoning: string
}

export type ApolloMultichannelSequenceTemplate = {
  sequence_key: string
  sequence_version: string
  sequence_label: string
  channel_order: ApolloOrchestrationChannelId[]
  recommendation_reason: string
}

export type ApolloMultichannelSchedulingTouch = {
  day_offset: number
  channel: ApolloOrchestrationChannelId
  spacing_days_from_prior: number
  cadence_label: string
  reason: string
}

export type ApolloMultichannelSchedulingPlan = {
  plan_version: string
  total_days: number
  spacing_strategy: string
  channel_cadence: string
  touches: ApolloMultichannelSchedulingTouch[]
}

export type ApolloMultichannelChannelIntelligence = {
  strongest_channel: ApolloOrchestrationChannelId | null
  highest_confidence_channel: ApolloOrchestrationChannelId | null
  fallback_channels: ApolloOrchestrationChannelId[]
  channel_risk: "low" | "medium" | "high"
  channel_scores: Record<string, number>
  channel_recommendations: string[]
  fallback_strategy: string
}

export type ApolloMultichannelOperatorSummary = {
  why_selected: string
  recommended_sequence: string
  confidence: number
  channel_availability_summary: string
  scheduling_summary: string
}

export type ApolloMultichannelAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  voice_drop_source: string
  multichannel_source: string
  attribution_chain: ApolloMultichannelSourceAttribution[]
}

export type ApolloMultichannelSequenceCandidateRow = {
  candidate_id: string
  voice_drop_candidate_id: string
  enrollment_candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  growth_lead_id: string | null
  status: ApolloMultichannelSequenceCandidateStatus
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualification_score: number
  fit_score: number | null
  orchestration_confidence: number
  channel_availability: ApolloChannelAvailability
  orchestration_result: ApolloMultichannelOrchestrationResult
  sequence_template: ApolloMultichannelSequenceTemplate
  scheduling_plan: ApolloMultichannelSchedulingPlan
  channel_intelligence: ApolloMultichannelChannelIntelligence
  operator_summary: ApolloMultichannelOperatorSummary
  source_attribution: ApolloMultichannelAttributionRecord
  created_at: string
  sequence_approved_at: string | null
  sequence_approved_email: string | null
}

export type ApolloMultichannelSequenceQueueSnapshot = {
  qa_marker: typeof APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER
  queue_label: "Multi-Channel Ready"
  items: ApolloMultichannelSequenceCandidateRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    regenerated: number
  }
  outreach_sent: false
  voice_drop_sent: false
  draft_created: false
  jobs_scheduled: false
}

export type ApolloMultichannelOrchestrationFunnelMetrics = {
  qa_marker: typeof APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER
  enrollment_candidates: number
  voice_drop_candidates: number
  sequence_candidates: number
  approved_sequences: number
  rejected_sequences: number
  channel_mix: Record<string, number>
  sequence_mix: Record<string, number>
  average_confidence: number
  computed_at: string
}

export type ApolloMultichannelOrchestrationActionResult = {
  ok: boolean
  action:
    | "create_from_voice_drop"
    | "approve_sequence"
    | "reject_sequence"
    | "regenerate_recommendation"
  candidate_id: string | null
  candidate_ids: string[]
  status: ApolloMultichannelSequenceCandidateStatus | null
  error?: string | null
  materialization_attempted?: boolean
  materialization_error?: string | null
  sequence_execution_candidate_id?: string | null
  sequence_enrollment_id?: string | null
  outreach_sent: false
  voice_drop_sent: false
  draft_created: false
  jobs_scheduled: false
}

export type ApolloMultichannelOrchestrationReport = {
  qa_marker: typeof APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER
  automation_id: typeof APOLLO_MULTICHANNEL_ORCHESTRATION_ID
  execution_id: string
  voice_drop_candidate_id: string | null
  candidates_created: number
  candidates_skipped_duplicate: number
  funnel_metrics: ApolloMultichannelOrchestrationFunnelMetrics
  candidates: ApolloMultichannelSequenceCandidateRow[]
  blockers: string[]
  outreach_sent: false
  voice_drop_sent: false
  draft_created: false
  jobs_scheduled: false
  completed_at: string
}

export type ApolloMultichannelOrchestrationCertificationReport = {
  qa_marker: typeof APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  attribution_preserved: boolean
  duplicate_prevention_verified: boolean
  approval_flow_verified: boolean
  sequence_generation_verified: boolean
  cadence_generation_verified: boolean
  safety: {
    outreach_sent: false
    voice_drop_sent: false
    email_sent: false
    sms_sent: false
    call_placed: false
    draft_created: false
    jobs_scheduled: false
  }
  funnel_metrics: ApolloMultichannelOrchestrationFunnelMetrics | null
  summary: string
}

export type ApolloMultichannelVoiceDropHandoffInput = {
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
  fit_score: number | null
  voice_drop_score: number | null
  channel_availability: ApolloChannelAvailability
  channel_confidence: number
  multichannel_strategy_key: string | null
  source_attribution: Record<string, unknown>
  operator_intelligence: Record<string, unknown>
  engagement_history_present?: boolean
  prior_outreach_count?: number
}
