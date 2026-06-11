/** Apollo Meeting Bridge (M1-A) types — client-safe. */

import type { GeneratedBookingRecommendation } from "@/lib/growth/booking-intelligence/booking-recommendation"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { ApolloAccountPlaybookMemberRoleSummary } from "@/lib/growth/apollo/apollo-account-playbooks-types"

export const APOLLO_MEETING_BRIDGE_QA_MARKER = "apollo-meeting-bridge-m1a-v1" as const

export const APOLLO_MEETING_BRIDGE_ID = "apollo-meeting-bridge-m1a-v1" as const

export const APOLLO_MEETING_BRIDGE_MIGRATION =
  "20270818120000_growth_engine_meeting_candidates_m1a.sql" as const

export const APOLLO_MEETING_CANDIDATE_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "scheduled",
  "completed",
] as const

export type ApolloMeetingCandidateStatus = (typeof APOLLO_MEETING_CANDIDATE_STATUSES)[number]

export const APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
  "Reply Intelligence",
  "Meeting Candidate",
] as const

export type ApolloMeetingBridgeSourceAttribution =
  (typeof APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION)[number]

/** Configurable, evidence-backed trigger rules for meeting candidate generation. */
export const APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS = [
  "meeting_request",
  "demo_request",
  "positive_interest",
  "pricing_question",
] as const satisfies readonly GrowthReplyIntent[]

export const APOLLO_MEETING_BRIDGE_QUALIFICATION_STATUS_TRIGGERS = [
  "call_ready",
  "sales_ready",
] as const

export type ApolloMeetingBridgeReplyIntentTrigger =
  (typeof APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS)[number]

export type ApolloMeetingBridgeQualificationStatusTrigger =
  (typeof APOLLO_MEETING_BRIDGE_QUALIFICATION_STATUS_TRIGGERS)[number]

export type ApolloMeetingBridgeTriggerEvidence = {
  triggered: boolean
  trigger_source: "reply_intelligence" | "qualification_state" | "none"
  matched_reply_intents: ApolloMeetingBridgeReplyIntentTrigger[]
  matched_qualification_signals: ApolloMeetingBridgeQualificationStatusTrigger[]
  evidence_snippets: string[]
  rule_version: string
}

export type ApolloMeetingBridgeAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  voice_drop_source: string
  multichannel_source: string
  sequence_execution_source: string
  reply_intelligence_source: string
  meeting_candidate_source: string
  attribution_chain: ApolloMeetingBridgeSourceAttribution[]
}

export type ApolloMeetingReadinessSnapshot = {
  meeting_readiness_score: number
  committee_coverage_score: number
  qualification_score: number
  reply_intent: GrowthReplyIntent | null
  reply_confidence: number | null
  trigger_evidence: ApolloMeetingBridgeTriggerEvidence
  readiness_factors: string[]
}

export type ApolloMeetingBridgeLeadInput = {
  lead_id: string
  company_name: string
  status: string
  owner_user_id?: string | null
  opportunity_readiness_tier?: string | null
}

export type ApolloMeetingBridgeCompanyInput = {
  company_id: string | null
  company_name: string
  canonical_company_id?: string | null
  company_candidate_id?: string | null
}

export type ApolloMeetingBridgeAccountPlaybookInput = {
  account_playbook_id: string | null
  committee_role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  committee_coverage_score: number
  committee_strategy: string
  coverage_status?: string | null
}

export type ApolloMeetingBridgeSequenceExecutionInput = {
  sequence_execution_id: string | null
  sequence_enrollment_id?: string | null
  multichannel_sequence_candidate_id?: string | null
  voice_drop_candidate_id?: string | null
  enrollment_candidate_id?: string | null
  status?: string | null
}

export type ApolloMeetingBridgeReplyIntelligenceInput = {
  outbound_reply_id: string | null
  intent: GrowthReplyIntent | null
  classification_v2?: GrowthReplyIntent | null
  confidence?: number | null
  confidence_tier?: string | null
  subject?: string | null
  body?: string | null
  engagement_score?: number | null
  has_active_sequence?: boolean
}

export type ApolloMeetingBridgeQualificationInput = {
  qualification_score: number
  lead_status: string
  opportunity_readiness_tier?: string | null
  qualification_snapshot?: Record<string, unknown>
}

export type ApolloMeetingBridgePipelineInput = {
  lead: ApolloMeetingBridgeLeadInput
  company: ApolloMeetingBridgeCompanyInput
  account_playbook: ApolloMeetingBridgeAccountPlaybookInput
  sequence_execution: ApolloMeetingBridgeSequenceExecutionInput
  reply_intelligence: ApolloMeetingBridgeReplyIntelligenceInput
  qualification: ApolloMeetingBridgeQualificationInput
  source_attribution?: Record<string, unknown> | null
}

export type ApolloMeetingBridgeResult = {
  ok: boolean
  action: "create_meeting_candidate" | "skip_no_trigger" | "skip_duplicate"
  meeting_candidate_created: boolean
  candidate_id: string | null
  status: ApolloMeetingCandidateStatus | null
  meeting_readiness_snapshot: ApolloMeetingReadinessSnapshot | null
  booking_recommendation_candidate: GeneratedBookingRecommendation | null
  trigger_evidence: ApolloMeetingBridgeTriggerEvidence | null
  error?: string | null
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
}

export type ApolloMeetingCandidateRow = {
  candidate_id: string
  lead_id: string
  company_id: string | null
  company_candidate_id: string | null
  account_playbook_id: string | null
  sequence_execution_id: string | null
  outbound_reply_id: string | null
  growth_meeting_id: string | null
  booking_recommendation_id: string | null
  company_name: string
  lead_status: string
  qualification_snapshot: Record<string, unknown>
  committee_role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  committee_coverage_score: number
  committee_strategy: string
  meeting_readiness_score: number
  confidence_score: number
  meeting_readiness_snapshot: ApolloMeetingReadinessSnapshot
  booking_recommendation_candidate: GeneratedBookingRecommendation | null
  trigger_evidence: ApolloMeetingBridgeTriggerEvidence
  source_attribution: ApolloMeetingBridgeAttributionRecord
  status: ApolloMeetingCandidateStatus
  created_at: string
  approved_at: string | null
  approved_email: string | null
  rejection_note: string | null
}

export type ApolloMeetingCandidateQueueSnapshot = {
  qa_marker: typeof APOLLO_MEETING_BRIDGE_QA_MARKER
  queue_label: "Meeting Candidates Ready"
  items: ApolloMeetingCandidateRow[]
  summary: {
    total: number
    pending_review: number
    approved: number
    rejected: number
    scheduled: number
    completed: number
    meeting_ready: number
  }
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
}

export type ApolloMeetingCandidateFunnelMetrics = {
  qa_marker: typeof APOLLO_MEETING_BRIDGE_QA_MARKER
  candidates_created: number
  candidates_approved: number
  candidates_rejected: number
  meetings_scheduled: number
  meetings_completed: number
  trigger_mix: Record<string, number>
  computed_at: string
}

export type ApolloMeetingCandidateActionResult = {
  ok: boolean
  action: "create_meeting_candidate" | "approve_meeting_candidate" | "reject_meeting_candidate"
  candidate_id: string | null
  status: ApolloMeetingCandidateStatus | null
  growth_meeting_id: string | null
  error?: string | null
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
}

export type ApolloMeetingBridgeAutomationReport = {
  qa_marker: typeof APOLLO_MEETING_BRIDGE_QA_MARKER
  automation_id: typeof APOLLO_MEETING_BRIDGE_ID
  execution_id: string
  sequence_execution_candidate_id: string | null
  candidates_created: number
  candidates_skipped_duplicate: number
  candidates_skipped_no_trigger: number
  funnel_metrics: ApolloMeetingCandidateFunnelMetrics
  bridge_result: ApolloMeetingBridgeResult | null
  blockers: string[]
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
  completed_at: string
}

export type ApolloMeetingBridgeCertificationReport = {
  qa_marker: typeof APOLLO_MEETING_BRIDGE_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  funnel_metrics: ApolloMeetingCandidateFunnelMetrics | null
  outreach_sent: false
  calendar_written: false
  meeting_scheduled: false
}
