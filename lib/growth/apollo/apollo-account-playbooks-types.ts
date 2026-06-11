/** Apollo Account Playbooks (ABP-1) types — client-safe. */

export const APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER = "apollo-account-playbooks-abp-1-v1" as const

export const APOLLO_ACCOUNT_PLAYBOOKS_ID = "apollo-account-playbooks-abp-1-v1" as const

export const APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION =
  "20270817120000_growth_engine_account_playbooks_abp_1.sql" as const

export const APOLLO_ACCOUNT_PLAYBOOK_STATUSES = [
  "pending_playbook_approval",
  "playbook_approved",
  "playbook_rejected",
  "playbook_rerun_requested",
] as const

export type ApolloAccountPlaybookStatus = (typeof APOLLO_ACCOUNT_PLAYBOOK_STATUSES)[number]

export const APOLLO_ACCOUNT_PLAYBOOK_COMMITTEE_ROLE_CATEGORIES = [
  "Executive",
  "Operations",
  "Technical",
  "Financial",
  "End User",
  "Unknown",
] as const

export type ApolloAccountPlaybookCommitteeRoleCategory =
  (typeof APOLLO_ACCOUNT_PLAYBOOK_COMMITTEE_ROLE_CATEGORIES)[number]

export const APOLLO_ACCOUNT_PLAYBOOK_COVERAGE_STATUSES = ["Weak", "Partial", "Strong"] as const

export type ApolloAccountPlaybookCoverageStatus =
  (typeof APOLLO_ACCOUNT_PLAYBOOK_COVERAGE_STATUSES)[number]

export const APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION = [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
] as const

export type ApolloAccountPlaybookSourceAttribution =
  (typeof APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION)[number]

export type ApolloAccountPlaybookChannelAvailability = {
  email: boolean
  phone: boolean
  sms: boolean
  linkedin: boolean
  voice_drop: boolean
}

export type ApolloAccountPlaybookCommitteeMemberInput = {
  person_id?: string | null
  full_name: string
  title: string | null
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  contactable?: boolean
  is_decision_maker?: boolean
}

export type ApolloAccountPlaybookCompanyProfile = {
  company_name: string
  industry?: string | null
  employee_count?: number | null
  summary?: string | null
  fit_score?: number | null
  research_score?: number | null
}

export type ApolloAccountPlaybookQualificationData = {
  qualification_score: number
  fit_score?: number | null
  research_score?: number | null
  buying_committee_present?: boolean
  buying_committee_coverage?: number | null
}

export type ApolloAccountPlaybookEngineInput = {
  canonical_company_id: string
  company_profile: ApolloAccountPlaybookCompanyProfile
  buying_committee_members: ApolloAccountPlaybookCommitteeMemberInput[]
  qualification_data: ApolloAccountPlaybookQualificationData
  channel_availability: ApolloAccountPlaybookChannelAvailability
}

export type ApolloAccountPlaybookMemberRoleSummary = {
  full_name: string
  title: string | null
  role_category: ApolloAccountPlaybookCommitteeRoleCategory
  recommended_messaging_theme: string[]
  recommended_channel_mix: string[]
  contactable: boolean
}

export type ApolloAccountPlaybookEngineResult = {
  playbook_key: string
  committee_strategy: string
  recommended_roles: ApolloAccountPlaybookCommitteeRoleCategory[]
  recommended_channels: string[]
  committee_role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  committee_coverage_score: number
  coverage_status: ApolloAccountPlaybookCoverageStatus
  recommended_messaging_theme: Record<ApolloAccountPlaybookCommitteeRoleCategory, string[]>
  recommended_channel_mix: Record<ApolloAccountPlaybookCommitteeRoleCategory, string[]>
  confidence_score: number
  reasoning: string
}

export type ApolloAccountPlaybookAttributionRecord = {
  apollo_source: string
  qualification_source: string
  enrollment_source: string
  account_playbook_source: string
  attribution_chain: ApolloAccountPlaybookSourceAttribution[]
}

export type ApolloAccountPlaybookRow = {
  playbook_id: string
  enrollment_candidate_id: string
  company_candidate_id: string
  canonical_company_id: string | null
  company_contact_id: string | null
  contact_candidate_id: string | null
  growth_lead_id: string | null
  status: ApolloAccountPlaybookStatus
  company_name: string
  playbook_key: string
  committee_strategy: string
  recommended_roles: ApolloAccountPlaybookCommitteeRoleCategory[]
  recommended_channels: string[]
  committee_role_summary: ApolloAccountPlaybookMemberRoleSummary[]
  committee_coverage_score: number
  coverage_status: ApolloAccountPlaybookCoverageStatus
  recommended_messaging_theme: Record<string, string[]>
  recommended_channel_mix: Record<string, string[]>
  confidence_score: number
  reasoning: string
  source_attribution: ApolloAccountPlaybookAttributionRecord
  created_at: string
  playbook_approved_at: string | null
  playbook_approved_email: string | null
}

export type ApolloAccountPlaybookMemberRow = {
  member_id: string
  account_playbook_id: string
  full_name: string
  title: string | null
  role_category: ApolloAccountPlaybookCommitteeRoleCategory
  recommended_messaging_theme: string[]
  recommended_channel_mix: string[]
  contactable: boolean
  is_decision_maker: boolean
}

export type ApolloAccountPlaybookQueueSnapshot = {
  qa_marker: typeof APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER
  queue_label: "Account Playbook Ready"
  items: ApolloAccountPlaybookRow[]
  summary: {
    total: number
    pending: number
    approved: number
    rejected: number
    rerun_requested: number
    playbook_ready: number
  }
  outreach_sent: false
}

export type ApolloAccountPlaybookFunnelMetrics = {
  qa_marker: typeof APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER
  enrollment_approvals: number
  account_playbooks: number
  approved_playbooks: number
  rejected_playbooks: number
  playbook_ready_accounts: number
  coverage_status_mix: Record<ApolloAccountPlaybookCoverageStatus, number>
  role_category_mix: Record<ApolloAccountPlaybookCommitteeRoleCategory, number>
  computed_at: string
}

export type ApolloAccountPlaybookAutomationActionResult = {
  ok: boolean
  action:
    | "create_from_enrollment"
    | "approve_playbook"
    | "reject_playbook"
    | "rerun_playbook"
  playbook_id: string | null
  playbook_ids: string[]
  status: ApolloAccountPlaybookStatus | null
  error?: string | null
  outreach_sent: false
}

export type ApolloAccountPlaybookAutomationReport = {
  qa_marker: typeof APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER
  automation_id: typeof APOLLO_ACCOUNT_PLAYBOOKS_ID
  execution_id: string
  enrollment_candidate_id: string | null
  playbooks_created: number
  playbooks_skipped_duplicate: number
  funnel_metrics: ApolloAccountPlaybookFunnelMetrics
  playbooks: ApolloAccountPlaybookRow[]
  blockers: string[]
  outreach_sent: false
  completed_at: string
}

export type ApolloAccountPlaybookCertificationReport = {
  qa_marker: typeof APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
  attribution_preserved: boolean
  duplicate_prevention_verified: boolean
  approval_flow_verified: boolean
  engine_verified: boolean
  safety: { outreach_sent: false }
  funnel_metrics: ApolloAccountPlaybookFunnelMetrics | null
  summary: string
}

export type ApolloAccountPlaybookEnrollmentHandoffInput = {
  enrollment_candidate_id: string
  company_candidate_id: string
  canonical_company_id: string | null
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
  buying_committee_members?: ApolloAccountPlaybookCommitteeMemberInput[]
}

export type ApolloAccountPlaybookVoiceDropHandoffInput = ApolloAccountPlaybookEnrollmentHandoffInput & {
  account_playbook_id: string
  playbook_result: ApolloAccountPlaybookEngineResult
  source_attribution: ApolloAccountPlaybookAttributionRecord
}
