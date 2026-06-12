/** Apollo 25-company pilot launch — client-safe types (Phase 14). */

import type {
  Apollo25CompanyPilotSelectionMode,
  Apollo25CompanyPilotSkipReason,
} from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"

export const APOLLO_25_COMPANY_PILOT_QA_MARKER = "apollo-25-company-pilot-launch-v14" as const

export const APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER =
  "apollo-25-company-pilot-cohort-v14-2f" as const

export type Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry = {
  canonical_company_id: string
  kept_company_candidate_id: string
  removed_company_candidate_ids: string[]
}

export type Apollo25CompanyPilotCohortCanonicalDedupeSummary = {
  qa_marker: string
  canonical_company_count: number
  duplicate_canonical_companies: number
  canonical_duplicates_removed: number
  dedupe_audit: Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry[]
  excluded_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
}

export const APOLLO_25_COMPANY_PILOT_TARGET_COUNT = 25 as const

export type Apollo25CompanyPilotSelectedContact = {
  full_name: string
  title: string | null
  company_contact_id: string | null
  contact_candidate_id: string | null
  verified_email_status: "verified" | "available" | "missing"
  sequence_ready: boolean
  qualification_score: number
  suppression_status: "clear" | "suppressed" | "unsubscribe_risk"
}

export type Apollo25CompanyPilotSelectionRow = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  selected_contact: Apollo25CompanyPilotSelectedContact
  qualification_score: number
  sequence_ready_status: boolean
  suppression_status: "clear" | "suppressed" | "unsubscribe_risk"
  selection_reason: string
  skipped_reason?: string | null
}

export type Apollo25CompanyPilotSelectionReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_QA_MARKER
  target_count: number
  selected_count: number
  eligible_pool_count: number
  production_qualification_threshold: number
  pilot_selection_mode: Apollo25CompanyPilotSelectionMode
  selected: Apollo25CompanyPilotSelectionRow[]
  skipped: Array<{
    company_candidate_id: string
    company_name: string
    reason: string
    skip_reason: Apollo25CompanyPilotSkipReason
  }>
}

export type Apollo25CompanyPilotEligibilityFunnelCounts = {
  total_apollo_discovered_companies: number
  companies_with_verified_email: number
  companies_with_sequence_ready_contacts: number
  companies_with_qualification_score_gte_threshold: number
  companies_blocked_by_re_enrollment: number
  companies_blocked_by_suppression: number
  companies_blocked_by_active_pilot: number
  companies_blocked_by_missing_lead_contact_linkage: number
  companies_blocked_by_materialization_readiness: number
  companies_eligible_greenfield: number
  companies_eligible_revalidation: number
}

export type Apollo25CompanyPilotEligibilityDiagnostic = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_QA_MARKER
  target_count: number
  production_qualification_threshold: number
  pilot_selection_mode: Apollo25CompanyPilotSelectionMode
  funnel_counts: Apollo25CompanyPilotEligibilityFunnelCounts
  skipped_reason_counts: Record<Apollo25CompanyPilotSkipReason, number>
  sample_blocked_companies: Array<{
    company_candidate_id: string
    company_name: string
    primary_skip_reason: Apollo25CompanyPilotSkipReason
    qualification_score: number
    enrollment_status: string | null
  }>
  remediation: string[]
}

export type Apollo25CompanyPilotPreflightCheck = {
  key: string
  label: string
  pass: boolean
  blocker: string | null
}

export type Apollo25CompanyPilotPreflightCompanyResult = {
  company_candidate_id: string
  company_name: string
  pass: boolean
  blockers: string[]
  checks: Apollo25CompanyPilotPreflightCheck[]
}

export type Apollo25CompanyPilotPreflightReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_QA_MARKER
  companies_evaluated: number
  companies_passed: number
  pilot_readiness_pct: number
  results: Apollo25CompanyPilotPreflightCompanyResult[]
  safety_summary: string
}

export type Apollo25CompanyPilotWorkloadEstimate = {
  enrollment_approvals_required: number
  playbook_approvals_required: number
  voice_drop_approvals_required: number
  multichannel_approvals_required: number
  draft_approvals_required: number
  job_approvals_required: number
  estimated_operator_hours: number
  primary_bottleneck: string
}

export type Apollo25CompanyPilotLaunchChecklistItem = {
  key: string
  label: string
  status: "pass" | "fail" | "warn" | "manual"
  detail: string
}

export type Apollo25CompanyPilotLaunchChecklist = {
  items: Apollo25CompanyPilotLaunchChecklistItem[]
  all_automated_pass: boolean
}

export type Apollo25CompanyPilotLaunchVerdict = "READY TO LAUNCH 25-COMPANY PILOT" | "NOT READY"

export type Apollo25CompanyPilotCohortSnapshotCompany = {
  company_candidate_id: string
  company_name: string
  qualification_score: number
  verified_email_count: number
  sequence_ready_count: number
  canonical_company_id: string | null
  enrollment_status: string | null
  cohort_rank: number
  cohort_reason: string
  ranking_explanation: string
}

export type Apollo25CompanyPilotCohortSnapshot = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER
  snapshot_id: string
  generated_at: string
  pilot_selection_mode: "greenfield"
  target_size: number
  cohort_size: number
  production_qualification_threshold: number
  immutable: true
  companies: Apollo25CompanyPilotCohortSnapshotCompany[]
  canonical_dedupe?: Apollo25CompanyPilotCohortCanonicalDedupeSummary
}

export type Apollo25CompanyPilotCohortLaunchCertification = {
  certified: boolean
  enrollment_ready_pct: number
  personalization_ready_pct: number
  blocking_issues: string[]
}

export type Apollo25CompanyPilotCohortEnrollmentReadinessCompany = {
  company_candidate_id: string
  company_name: string
  ready: boolean
  blockers: string[]
  checks: {
    verified_email: boolean
    sequence_ready_contact: boolean
    canonical_company_linkage: boolean
    company_intelligence: boolean
    qualification_gte_threshold: boolean
    no_suppression_conflict: boolean
    no_active_enrollment_conflict: boolean
  }
}

export type Apollo25CompanyPilotCohortEnrollmentReadinessSummary = {
  companies_evaluated: number
  companies_ready: number
  readiness_pct: number
  companies: Apollo25CompanyPilotCohortEnrollmentReadinessCompany[]
}

export type Apollo25CompanyPilotCohortPersonalizationAssetKey =
  | "account_playbook"
  | "personalization"
  | "content_quality_optimization"
  | "voice_drop_assets"
  | "email_assets"
  | "sms_assets"

export type Apollo25CompanyPilotCohortPersonalizationCompany = {
  company_candidate_id: string
  company_name: string
  ready: boolean
  missing_assets: Apollo25CompanyPilotCohortPersonalizationAssetKey[]
  assets: Record<Apollo25CompanyPilotCohortPersonalizationAssetKey, boolean>
}

export type Apollo25CompanyPilotCohortPersonalizationReport = {
  companies_evaluated: number
  companies_ready: number
  readiness_pct: number
  companies: Apollo25CompanyPilotCohortPersonalizationCompany[]
}

export type Apollo25CompanyPilotLaunchRecommendation = {
  ready_for_launch: boolean
  blocking_issues: string[]
  recommended_launch_size: number
}

export type Apollo25CompanyPilotCohortReview = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_COHORT_SNAPSHOT_QA_MARKER
  computed_at: string
  cohort_id: string | null
  cohort_name: string | null
  cohort_status: string | null
  snapshot: Apollo25CompanyPilotCohortSnapshot
  cohort_size: number
  target_size: number
  canonical_company_count: number
  duplicate_canonical_companies: number
  dedupe_audit: Apollo25CompanyPilotCohortCanonicalDedupeAuditEntry[]
  companies: Apollo25CompanyPilotCohortSnapshotCompany[]
  enrollment_readiness: Apollo25CompanyPilotCohortEnrollmentReadinessSummary
  personalization: Apollo25CompanyPilotCohortPersonalizationReport
  launch_recommendation: Apollo25CompanyPilotLaunchRecommendation
  launch_certification: Apollo25CompanyPilotCohortLaunchCertification
  no_outreach_side_effects: true
}

export type Apollo25CompanyPilotLaunchReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_QA_MARKER
  computed_at: string
  root_cause_summary: string
  eligibility_diagnostic: Apollo25CompanyPilotEligibilityDiagnostic
  selection: Apollo25CompanyPilotSelectionReport
  preflight: Apollo25CompanyPilotPreflightReport
  cohort_creation: {
    cohort_id: string | null
    cohort_name: string | null
    status: string | null
    company_count: number
    created: boolean
  }
  workload: Apollo25CompanyPilotWorkloadEstimate
  checklist: Apollo25CompanyPilotLaunchChecklist
  lifecycle_controls_validated: boolean
  verdict: Apollo25CompanyPilotLaunchVerdict
  recommendations: string[]
  no_outreach_side_effects: true
}
