/** Apollo 25-company pilot cohort enrollment bridge — shared types. */

import type { Apollo25CompanyPilotCohortReview } from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export const APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_QA_MARKER =
  "apollo-25-company-pilot-cohort-enrollment-bridge-v14-2j" as const

export const APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_SOURCE =
  "apollo-25-company-pilot-cohort-enroll-v14-2j" as const

export type Apollo25CompanyPilotCohortEnrollmentBridgeFailure = {
  company_candidate_id: string
  company_name: string
  code: string
  message: string
}

export type Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult = {
  company_candidate_id: string
  company_name: string
  enrollment_candidate_id: string | null
  growth_lead_id: string | null
  created: boolean
  reused: boolean
  approved: boolean
}

export type Apollo25CompanyPilotCohortEnrollmentBridgeReport = {
  qa_marker: typeof APOLLO_25_COMPANY_PILOT_COHORT_ENROLLMENT_BRIDGE_QA_MARKER
  cohort_id: string
  execution_id: string
  companies_processed: number
  enrollment_candidates_created: number
  enrollment_candidates_reused: number
  enrollment_candidates_approved: number
  failures: Apollo25CompanyPilotCohortEnrollmentBridgeFailure[]
  companies: Apollo25CompanyPilotCohortEnrollmentBridgeCompanyResult[]
  review: Apollo25CompanyPilotCohortReview
  ok: boolean
  no_outbound_sends: true
  no_sequence_execution: true
}
