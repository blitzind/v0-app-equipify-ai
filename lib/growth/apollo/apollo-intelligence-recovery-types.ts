/** Apollo intelligence recovery — client-safe types (Phase 14.2). */

import type { Apollo25CompanyPilotEligibilityFunnelCounts } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export const APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER = "apollo-intelligence-recovery-v14-2" as const

export const APOLLO_INTELLIGENCE_RECOVERY_MODES = [
  "diagnostic_only",
  "recover_missing_intelligence",
  "recompute_scores",
] as const

export type ApolloIntelligenceRecoveryMode = (typeof APOLLO_INTELLIGENCE_RECOVERY_MODES)[number]

export type ApolloIntelligenceRecoveryScoreDecompositionRow = {
  company_candidate_id: string
  company_name: string
  verified_email: boolean
  sequence_ready: boolean
  contactable: boolean
  current_score: number
  production_threshold: number
  missing_points_to_threshold: number
  sequence_ready_base_points: number
  contactable_base_points: number
  verified_email_points: number
  sequence_ready_cohort_points: number
  company_intelligence_points: number
  buying_committee_points: number
  buying_committee_coverage_points: number
  fit_score_points: number
  research_score_points: number
  blockers: string[]
  score_zero_reason: string | null
}

export type ApolloIntelligenceRecoveryScoreDecompositionSummary = {
  companies_at_65: number
  companies_at_55_to_64: number
  companies_below_55: number
  companies_with_score_zero: number
  score_zero_reasons: Record<string, number>
}

export type ApolloIntelligenceRecoveryCanonicalAuditRow = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  matched_by_domain: boolean
  matched_by_normalized_name: boolean
  matched_by_name_city: boolean
  matched_by_name_state: boolean
  matched_by_staging_linkage: boolean
  unresolved: boolean
  blocker_reason: string | null
  can_safely_link_or_create: boolean
  resolution_method: string | null
}

export type ApolloIntelligenceRecoveryIntelligenceAuditRow = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string | null
  company_intelligence_exists: boolean
  company_intelligence_verified: boolean
  buying_committee_exists: boolean
  buying_committee_member_count: number
  buying_committee_coverage: number | null
  fit_score_exists: boolean
  fit_score_value: number | null
  research_score_exists: boolean
  research_score_value: number | null
  latest_research_run_exists: boolean
  latest_research_run_id: string | null
  research_cache_stale_or_missing: boolean
  missing_inputs: string[]
}

export type ApolloIntelligenceRecoveryFunnelSnapshot = {
  discovered_companies: number
  verified_email_companies: number
  sequence_ready_companies: number
  score_gte_threshold_companies: number
  eligible_greenfield_companies: number
}

export type ApolloIntelligenceRecoveryCompanyResult = {
  company_candidate_id: string
  company_name: string
  before_score: number
  after_score: number
  intelligence_added: string[]
  remaining_blockers: string[]
  recovery_actions: string[]
  errors: string[]
}

export type ApolloIntelligenceRecoveryIntelligenceOutcome =
  | "skipped"
  | "reused"
  | "created"
  | "failed"

export type ApolloIntelligenceRecoveryCompanyEvidence = {
  company_candidate_id: string
  company_name: string
  canonical_company_id_before: string | null
  canonical_company_id_after: string | null
  canonical_resolution_attempted: boolean
  canonical_resolution_result: "resolved" | "unresolved" | "not_attempted"
  canonical_resolution_blocker: string | null
  company_intelligence_before: boolean
  company_intelligence_after: boolean
  company_intelligence_attempted: boolean
  company_intelligence_created_or_reused: boolean
  company_intelligence_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  company_intelligence_error: string | null
  buying_committee_before: boolean
  buying_committee_after: boolean
  buying_committee_attempted: boolean
  buying_committee_created_or_reused: boolean
  buying_committee_outcome: ApolloIntelligenceRecoveryIntelligenceOutcome
  buying_committee_error: string | null
  fit_score_before: number | null
  fit_score_after: number | null
  research_score_before: number | null
  research_score_after: number | null
  qualification_score_before: number
  qualification_score_after: number
  score_delta: number
  crossed_threshold: boolean
  remaining_blockers: string[]
  intelligence_added: string[]
  no_op_reason: string
}

export type ApolloIntelligenceRecoveryWriteEvidence = {
  canonical_resolution_attempted_count: number
  canonical_resolved_count: number
  canonical_unresolved_count: number
  company_intelligence_attempted_count: number
  company_intelligence_created_count: number
  company_intelligence_reused_count: number
  company_intelligence_failed_count: number
  buying_committee_attempted_count: number
  buying_committee_created_count: number
  buying_committee_reused_count: number
  buying_committee_failed_count: number
  companies_with_score_increase: number
  companies_crossed_threshold: number
  no_op_reason_counts: Record<string, number>
}

export type ApolloIntelligenceRecoveryReport = {
  qa_marker: typeof APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER
  mode: ApolloIntelligenceRecoveryMode
  computed_at: string
  writes_performed: boolean
  before: ApolloIntelligenceRecoveryFunnelSnapshot
  after: ApolloIntelligenceRecoveryFunnelSnapshot
  after_recovery_counts: {
    canonical_resolved_count: number
    company_intelligence_count: number
    buying_committee_count: number
    fit_score_count: number
    research_score_count: number
    score_gte_threshold_count: number
    projected_greenfield_eligible_count: number
  }
  score_decomposition: {
    rows: ApolloIntelligenceRecoveryScoreDecompositionRow[]
    summary: ApolloIntelligenceRecoveryScoreDecompositionSummary
  }
  canonical_audit: ApolloIntelligenceRecoveryCanonicalAuditRow[]
  intelligence_audit: ApolloIntelligenceRecoveryIntelligenceAuditRow[]
  company_results: ApolloIntelligenceRecoveryCompanyResult[]
  company_evidence: ApolloIntelligenceRecoveryCompanyEvidence[]
  write_evidence: ApolloIntelligenceRecoveryWriteEvidence
  recovery_ok: boolean
  severity: "ok" | "critical"
  no_op_root_cause: string | null
  top_no_op_reasons: string[]
  root_cause_summary: string
  no_outreach_side_effects: true
  no_enrollment_candidates_created: true
}

export type ApolloIntelligenceRecoveryReadiness = {
  qa_marker: typeof APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER
  ready: boolean
  blockers: string[]
  intelligence_schema_ready: boolean
  production_qualification_threshold: number
  apollo_discovered_company_count: number
  confirm_token: string
}
