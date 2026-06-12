/** Apollo Operations Dashboard — client-safe types (Phase 14.3B). */

import type { Apollo25CompanyPilotSkipReason } from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import type {
  Apollo25CompanyPilotCohortLaunchCertification,
  Apollo25CompanyPilotLaunchRecommendation,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"
import type { ApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-automation-types"

export const APOLLO_OPERATIONS_DASHBOARD_QA_MARKER =
  "apollo-operations-dashboard-v14-3b" as const

export type ApolloOperationsDiscoveryFunnelStage = {
  key: string
  label: string
  count: number
  conversion_pct: number | null
  trend_placeholder: null
}

export type ApolloOperationsDiscoveryFunnel = {
  companies_discovered: number
  verified_email_companies: number
  sequence_ready_companies: number
  qualified_companies: number
  greenfield_available: number
  certified_companies: number
  stages: ApolloOperationsDiscoveryFunnelStage[]
}

export type ApolloOperationsRejectionRow = {
  reason: Apollo25CompanyPilotSkipReason
  label: string
  count: number
  pct: number
}

export type ApolloOperationsContactFunnel = {
  contact_candidates: number
  verified_emails: number
  linkedin_profiles: number
  phone_numbers: number
  conversion: {
    candidates_to_verified_email_pct: number | null
    candidates_to_linkedin_pct: number | null
    candidates_to_phone_pct: number | null
  }
  apollo_phone_note: string
}

export type ApolloOperationsCohortFunnelRow = {
  cohort_id: string
  cohort_name: string
  status: string
  company_count: number
  target_company_count: number
  enrolled_count: number
  personalized_ready_count: number
  certified: boolean | null
  is_primary_certified: boolean
}

export type ApolloOperationsCohortFunnel = {
  portfolio: {
    draft_cohorts: number
    enrolled_companies: number
    personalized_ready_companies: number
    certified_companies: number
  }
  cohorts: ApolloOperationsCohortFunnelRow[]
}

export type ApolloOperationsCertificationStatus = {
  cohort_id: string | null
  cohort_name: string | null
  enrollment_ready_pct: number | null
  personalization_ready_pct: number | null
  ready_for_launch: boolean | null
  certified: boolean | null
  fatal_blockers: string[]
  warnings: string[]
  launch_recommendation: Apollo25CompanyPilotLaunchRecommendation | null
  launch_certification: Apollo25CompanyPilotCohortLaunchCertification | null
}

export type ApolloOperationsExpansionReadiness = {
  greenfield_available: number
  current_certified_cohort: number
  target_cohort_size: number
  additional_companies_needed_for_next_25_cohort: number
  greenfield_gap_to_target: number
}

export type ApolloOperationsCreditUtilization = {
  credits_available: number | null
  credits_consumed: number | null
  tracking_status: "not_yet_tracked" | "partial_evidence" | "available"
  note: string
}

export type ApolloOperationsDashboardPayload = {
  qa_marker: typeof APOLLO_OPERATIONS_DASHBOARD_QA_MARKER
  computed_at: string
  data_sources: string[]
  discovery_funnel: ApolloOperationsDiscoveryFunnel
  rejection_analysis: ApolloOperationsRejectionRow[]
  contact_funnel: ApolloOperationsContactFunnel
  cohort_funnel: ApolloOperationsCohortFunnel
  certification_status: ApolloOperationsCertificationStatus
  expansion_readiness: ApolloOperationsExpansionReadiness
  credit_utilization: ApolloOperationsCreditUtilization
  enrollment_automation_funnel: ApolloEnrollmentFunnelMetrics | null
}

export const APOLLO_OPERATIONS_SKIP_REASON_LABELS: Record<Apollo25CompanyPilotSkipReason, string> = {
  no_verified_email: "No verified email",
  not_sequence_ready: "Not sequence-ready",
  qualification_below_threshold: "Qualification below threshold",
  already_enrollment_approved: "Already enrollment approved",
  active_enrollment_conflict: "Active enrollment conflict",
  suppression_conflict: "Suppression conflict",
  active_pilot_conflict: "Active pilot conflict",
  missing_company_contact: "Missing company contact",
  missing_growth_lead: "Missing growth lead",
  missing_required_identity: "Missing required identity",
  materialization_not_ready: "Materialization not ready",
  preflight_failed: "Preflight failed",
  duplicate_company_in_pool: "Duplicate company in pool",
}

export function apolloOperationsPct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}
