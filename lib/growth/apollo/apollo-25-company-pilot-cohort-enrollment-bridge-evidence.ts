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

export function evaluateApollo25CompanyPilotCohortEnrollmentBridgeSuccess(input: {
  companies: Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult[]
  enrollment_candidates_created: number
  enrollment_candidates_reused: number
  enrollment_candidates_approved: number
}): boolean {
  return (
    input.companies.length > 0 &&
    (input.enrollment_candidates_created > 0 ||
      input.enrollment_candidates_reused > 0 ||
      input.enrollment_candidates_approved > 0)
  )
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
}
