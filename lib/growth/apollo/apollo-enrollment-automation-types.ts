/** Apollo Enrollment Automation types — client-safe. */

import type { ApolloPipelineAttributionDisplay } from "@/lib/growth/apollo/apollo-pipeline-attribution-display"
import type { ApolloQueuePaginationMeta } from "@/lib/growth/apollo/apollo-queue-pagination"

export const APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER =
  "apollo-enrollment-automation-v1" as const

export const APOLLO_ENROLLMENT_AUTOMATION_ID = "apollo-enrollment-automation-v1" as const

export const APOLLO_ENROLLMENT_CANDIDATE_STATUSES = [
  "pending_enrollment_approval",
  "enrollment_approved",
  "enrollment_rejected",
  "research_rerun_requested",
] as const

export type ApolloEnrollmentCandidateStatus =
  (typeof APOLLO_ENROLLMENT_CANDIDATE_STATUSES)[number]

export const APOLLO_ENROLLMENT_AUTOMATION_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Enrichment",
  "Promotion",
  "Qualification",
  "Enrollment",
] as const

export type ApolloEnrollmentAutomationSourceAttribution =
  (typeof APOLLO_ENROLLMENT_AUTOMATION_SOURCE_ATTRIBUTION)[number]

export type ApolloEnrollmentAttributionRecord = {
  apollo_source: string
  apollo_search_tier: string | null
  verified_email_source: string | null
  enrichment_source: string | null
  qualification_source: string
  enrollment_source: string
  attribution_chain: ApolloEnrollmentAutomationSourceAttribution[]
}

export type ApolloEnrollmentQualificationInput = {
  mapped_contacts: number
  verified_email_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  company_intelligence_present: boolean
  buying_committee_present: boolean
  buying_committee_coverage: number | null
  fit_score: number | null
  research_score: number | null
  contact_sequence_ready: boolean
  contact_contactable: boolean
  contact_blockers: string[]
  apollo_search_tier: string | null
  verified_email_source: string | null
  enrichment_source: string | null
}

export type ApolloEnrollmentQualificationResult = {
  qualified_for_enrollment: boolean
  qualification_reason: string
  qualification_score: number
  threshold: number
  score_breakdown: Record<string, number>
}

export type ApolloEnrollmentOperatorIntelligence = {
  why_selected: string
  likely_decision_maker_role: string | null
  company_summary: string | null
  research_summary: string | null
  buying_committee_summary: string | null
  recommended_first_channel: "email" | "phone" | "linkedin"
  recommended_sequence: string | null
  apollo_evidence_summary: string | null
}

export type ApolloEnrollmentCandidateRow = {
  candidate_id: string
  company_candidate_id: string
  company_contact_id: string | null
  contact_candidate_id: string | null
  growth_lead_id: string | null
  prospect_id: string | null
  status: ApolloEnrollmentCandidateStatus
  company_name: string
  full_name: string
  title: string | null
  email: string | null
  phone: string | null
  qualified_for_enrollment: boolean
  qualification_reason: string | null
  qualification_score: number
  fit_score: number | null
  research_score: number | null
  source_attribution: ApolloEnrollmentAttributionRecord
  operator_intelligence: ApolloEnrollmentOperatorIntelligence
  acquisition_evidence: Record<string, unknown>
  created_at: string
  enrollment_approved_at: string | null
  enrollment_approved_email: string | null
  attribution_display: ApolloPipelineAttributionDisplay
}

export type ApolloEnrollmentCandidateQueueSnapshot = {
  qa_marker: typeof APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER
  queue_label: "Apollo Ready For Enrollment"
  items: ApolloEnrollmentCandidateRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    research_rerun: number
    qualified: number
  }
  auto_enrollment: false
  outreach_sent: false
  pagination?: ApolloQueuePaginationMeta
}

export type ApolloEnrollmentFunnelMetrics = {
  qa_marker: typeof APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER
  funnel_view?: "historical" | "current_run"
  companies_searched: number
  contacts_found: number
  contacts_mapped: number
  verified_emails: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  qualified_contacts: number
  enrollment_candidates: number
  enrollment_approvals: number
  enrollment_rejections: number
  computed_at: string
}

export type ApolloEnrollmentAutomationActionResult = {
  ok: boolean
  action:
    | "auto_enroll"
    | "approve_enrollment"
    | "reject_enrollment"
    | "rerun_research"
  candidate_id: string | null
  candidate_ids: string[]
  status: ApolloEnrollmentCandidateStatus | null
  error?: string | null
  auto_enrollment: false
  outreach_sent: false
  enrolled_count: 0
  outreach_count: 0
}

export type ApolloEnrollmentAutomationReport = {
  qa_marker: typeof APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER
  automation_id: typeof APOLLO_ENROLLMENT_AUTOMATION_ID
  execution_id: string
  company_candidate_id: string | null
  contacts_evaluated: number
  contacts_qualified: number
  candidates_created: number
  candidates_skipped_duplicate: number
  candidates_skipped_re_enrollment: number
  funnel_metrics: ApolloEnrollmentFunnelMetrics
  candidates: ApolloEnrollmentCandidateRow[]
  blockers: string[]
  auto_enrollment: false
  outreach_sent: false
  draft_created: false
  completed_at: string
}

export type ApolloEnrollmentCertificationReport = {
  qa_marker: typeof APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{
    id: string
    satisfied: boolean
    detail: string
  }>
  attribution_preserved: boolean
  duplicate_prevention_verified: boolean
  re_enrollment_prevention_verified: boolean
  approval_flow_verified: boolean
  safety: {
    draft_created: false
    draft_approved: false
    outreach_executed: false
    email_sent: false
    sms_sent: false
    voice_drop_sent: false
  }
  funnel_metrics: ApolloEnrollmentFunnelMetrics | null
  summary: string
}
