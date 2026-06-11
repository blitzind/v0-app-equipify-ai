/** Apollo Voice Drop Automation types — client-safe. */

export const APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER =
  "apollo-voice-drop-automation-v1" as const

export const APOLLO_VOICE_DROP_AUTOMATION_ID = "apollo-voice-drop-automation-v1" as const

export const APOLLO_VOICE_DROP_CANDIDATE_STATUSES = [
  "pending_voice_drop_approval",
  "voice_drop_approved",
  "voice_drop_rejected",
  "intelligence_rerun_requested",
] as const

export type ApolloVoiceDropCandidateStatus =
  (typeof APOLLO_VOICE_DROP_CANDIDATE_STATUSES)[number]

export const APOLLO_VOICE_DROP_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
] as const

export type ApolloVoiceDropSourceAttribution =
  (typeof APOLLO_VOICE_DROP_SOURCE_ATTRIBUTION)[number]

export const APOLLO_VOICE_DROP_SCRIPT_TYPES = [
  "cold_introduction",
  "referral_style",
  "equipment_service_focused",
  "biomedical_specific",
  "follow_up",
] as const

export type ApolloVoiceDropScriptType = (typeof APOLLO_VOICE_DROP_SCRIPT_TYPES)[number]

export type ApolloOutreachChannelId =
  | "email"
  | "phone"
  | "mobile_phone"
  | "sms"
  | "voice_drop"
  | "linkedin"

export type ApolloChannelAvailability = {
  verified_email: boolean
  phone: boolean
  mobile_phone: boolean
  sms_capable: boolean
  voice_drop_capable: boolean
  linkedin: boolean
}

export type ApolloChannelRecommendation = {
  recommended_first_channel: ApolloOutreachChannelId
  recommended_second_channel: ApolloOutreachChannelId | null
  recommended_sequence_strategy: string
  recommendation_reasons: string[]
  confidence_score: number
}

export type ApolloMultichannelSequenceStep = {
  channel: ApolloOutreachChannelId
  delay_days: number
  reason: string
}

export type ApolloMultichannelStrategy = {
  strategy_key: string
  strategy_label: string
  steps: ApolloMultichannelSequenceStep[]
  recommendation_source: string
  confidence: number
  reasoning: string
}

export type ApolloVoiceDropIntelligence = {
  recommended_script_type: ApolloVoiceDropScriptType
  voicemail_objective: string
  personalization_opportunities: string[]
  call_to_action_recommendation: string
  intelligence_summary: string
}

export type ApolloVoiceDropScript = {
  script_type: ApolloVoiceDropScriptType
  intro: string
  value_proposition: string
  personalization_line: string
  call_to_action: string
  full_script: string
  personalization_data: Record<string, string | null>
}

export type ApolloVoiceDropAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  voice_drop_source: string
  attribution_chain: ApolloVoiceDropSourceAttribution[]
}

export type ApolloVoiceDropCandidateRow = {
  candidate_id: string
  enrollment_candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  growth_lead_id: string | null
  status: ApolloVoiceDropCandidateStatus
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualification_score: number
  voice_drop_score: number
  recommendation_confidence: number
  channel_availability: ApolloChannelAvailability
  channel_recommendations: ApolloChannelRecommendation
  multichannel_strategy: ApolloMultichannelStrategy
  voice_drop_intelligence: ApolloVoiceDropIntelligence
  voice_drop_script: ApolloVoiceDropScript
  source_attribution: ApolloVoiceDropAttributionRecord
  created_at: string
  voice_drop_approved_at: string | null
  voice_drop_approved_email: string | null
}

export type ApolloVoiceDropCandidateQueueSnapshot = {
  qa_marker: typeof APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER
  queue_label: "Voice Drops Ready"
  items: ApolloVoiceDropCandidateRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    intelligence_rerun: number
    voice_ready: number
  }
  voice_drop_sent: false
  outreach_sent: false
  draft_created: false
}

export type ApolloVoiceDropFunnelMetrics = {
  qa_marker: typeof APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER
  enrollment_candidates: number
  enrollment_approvals: number
  voice_drop_candidates: number
  approved_voice_drops: number
  rejected_voice_drops: number
  voice_ready_contacts: number
  recommended_channel_mix: Record<string, number>
  computed_at: string
}

export type ApolloVoiceDropAutomationActionResult = {
  ok: boolean
  action:
    | "create_from_enrollment"
    | "approve_voice_drop"
    | "reject_voice_drop"
    | "rerun_intelligence"
  candidate_id: string | null
  candidate_ids: string[]
  status: ApolloVoiceDropCandidateStatus | null
  error?: string | null
  voice_drop_sent: false
  outreach_sent: false
  draft_created: false
}

export type ApolloVoiceDropAutomationReport = {
  qa_marker: typeof APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER
  automation_id: typeof APOLLO_VOICE_DROP_AUTOMATION_ID
  execution_id: string
  enrollment_candidate_id: string | null
  candidates_created: number
  candidates_skipped_duplicate: number
  funnel_metrics: ApolloVoiceDropFunnelMetrics
  candidates: ApolloVoiceDropCandidateRow[]
  blockers: string[]
  voice_drop_sent: false
  outreach_sent: false
  draft_created: false
  completed_at: string
}

export type ApolloVoiceDropCertificationReport = {
  qa_marker: typeof APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{
    id: string
    satisfied: boolean
    detail: string
  }>
  attribution_preserved: boolean
  duplicate_prevention_verified: boolean
  approval_flow_verified: boolean
  script_generation_verified: boolean
  recommendation_engine_verified: boolean
  safety: {
    voice_drop_sent: false
    call_placed: false
    sms_sent: false
    email_sent: false
    draft_created: false
  }
  funnel_metrics: ApolloVoiceDropFunnelMetrics | null
  summary: string
}

export type ApolloVoiceDropEnrollmentHandoffInput = {
  enrollment_candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  growth_lead_id: string | null
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualification_score: number
  fit_score: number | null
  research_score: number | null
  operator_intelligence: Record<string, unknown>
  source_attribution: Record<string, unknown>
  acquisition_evidence: Record<string, unknown>
}
