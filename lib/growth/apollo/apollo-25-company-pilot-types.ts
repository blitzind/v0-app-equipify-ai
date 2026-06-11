/** Apollo 25-company pilot launch — client-safe types (Phase 14). */

export const APOLLO_25_COMPANY_PILOT_QA_MARKER = "apollo-25-company-pilot-launch-v14" as const

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
  selected: Apollo25CompanyPilotSelectionRow[]
  skipped: Array<{ company_candidate_id: string; company_name: string; reason: string }>
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

export type Apollo25CompanyPilotLaunchReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_QA_MARKER
  computed_at: string
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
