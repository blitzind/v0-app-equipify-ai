/** Apollo 25-company pilot cohort enrollment bridge — client-safe helpers (Phase 14.2J.5). */

import type {
  Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult,
  Apollo25CompanyPilotCohortEnrollmentBridgeFailure,
} from "@/lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-types"
import type { Apollo25CompanyPilotCohortSnapshotCompany } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function snapshotCompanyQualificationPassesThreshold(
  snapshotCompany: Apollo25CompanyPilotCohortSnapshotCompany,
  production_threshold: number,
): boolean {
  return snapshotCompany.qualification_score >= production_threshold
}

export function evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome(input: {
  companies_processed: number
  companies: Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult[]
  failures: Apollo25CompanyPilotCohortEnrollmentBridgeFailure[]
  enrollment_candidates_approved: number
}): { ok: boolean; partial_success: boolean } {
  const full_success =
    input.companies_processed > 0 &&
    input.failures.length === 0 &&
    input.companies.length === input.companies_processed &&
    input.enrollment_candidates_approved === input.companies_processed

  const partial_success =
    !full_success &&
    (input.enrollment_candidates_approved > 0 ||
      input.companies.some((company) => company.approved))

  return {
    ok: full_success,
    partial_success,
  }
}

/** @deprecated Use evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome */
export function evaluateApollo25CompanyPilotCohortEnrollmentBridgeSuccess(input: {
  companies: Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult[]
  enrollment_candidates_created: number
  enrollment_candidates_reused: number
  enrollment_candidates_approved: number
}): boolean {
  return evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome({
    companies_processed: input.companies.length + 0,
    companies: input.companies,
    failures: [],
    enrollment_candidates_approved: input.enrollment_candidates_approved,
  }).ok
}

export type Apollo25CompanyPilotCohortEnrollmentBridgeMetadataStamp = {
  execution_id: string
  executed_at: string
  companies_processed: number
  enrollment_candidates_created: number
  enrollment_candidates_reused: number
  enrollment_candidates_approved: number
  enrollment_readiness_pct: number
  failure_count: number
  failures: Apollo25CompanyPilotCohortEnrollmentBridgeFailure[]
  ok: boolean
  partial_success: boolean
}
