/** Apollo 25-company pilot cohort — enrollment readiness validation (Phase 14.2F). */

import {
  analyzeApollo25CompanyPilotCompanyEligibility,
  type Apollo25CompanyPilotSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type {
  Apollo25CompanyPilotCohortEnrollmentReadinessSummary,
  Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function evaluateApollo25CompanyPilotCohortEnrollmentReadiness(input: {
  snapshot_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
  selection_inputs: Apollo25CompanyPilotSelectionInput[]
  production_threshold?: number
}): Apollo25CompanyPilotCohortEnrollmentReadinessSummary {
  const production_threshold = input.production_threshold ?? 70
  const inputByCompany = new Map(
    input.selection_inputs.map((row) => [row.company_candidate_id.trim(), row]),
  )

  const companies = input.snapshot_companies.map((snapshotCompany) => {
    const selectionInput = inputByCompany.get(snapshotCompany.company_candidate_id.trim())
    if (!selectionInput) {
      return {
        company_candidate_id: snapshotCompany.company_candidate_id,
        company_name: snapshotCompany.company_name,
        ready: false,
        blockers: ["selection_input_missing"],
        checks: {
          verified_email: false,
          sequence_ready_contact: false,
          canonical_company_linkage: false,
          company_intelligence: false,
          qualification_gte_threshold: false,
          no_suppression_conflict: false,
          no_active_enrollment_conflict: false,
        },
      }
    }

    if (selectionInput.enrollment_status === "enrollment_approved") {
      const checks = {
        verified_email: true,
        sequence_ready_contact: true,
        canonical_company_linkage: Boolean(selectionInput.canonical_company_id?.trim()),
        company_intelligence: Boolean(selectionInput.company_intelligence_present),
        qualification_gte_threshold: true,
        no_suppression_conflict: true,
        no_active_enrollment_conflict: true,
      }
      const blockers: string[] = []
      if (!checks.canonical_company_linkage) blockers.push("canonical_company_linkage")
      if (!checks.company_intelligence) blockers.push("company_intelligence")
      if (!selectionInput.growth_lead_id?.trim()) blockers.push("missing_growth_lead")

      return {
        company_candidate_id: snapshotCompany.company_candidate_id,
        company_name: snapshotCompany.company_name,
        ready: blockers.length === 0,
        blockers,
        checks,
      }
    }

    const analysis = analyzeApollo25CompanyPilotCompanyEligibility(
      selectionInput,
      production_threshold,
      "greenfield",
    )

    const checks = {
      verified_email: analysis.signals.has_verified_email,
      sequence_ready_contact: analysis.signals.has_sequence_ready,
      canonical_company_linkage: Boolean(selectionInput.canonical_company_id?.trim()),
      company_intelligence: Boolean(selectionInput.company_intelligence_present),
      qualification_gte_threshold:
        analysis.score >= production_threshold && !analysis.signals.qualification_below_threshold,
      no_suppression_conflict: !analysis.signals.suppression_conflict,
      no_active_enrollment_conflict:
        !analysis.signals.active_pilot_conflict && !selectionInput.has_active_sequence_enrollment,
    }

    const blockers = Object.entries(checks)
      .filter(([, pass]) => !pass)
      .map(([key]) => key)

    return {
      company_candidate_id: snapshotCompany.company_candidate_id,
      company_name: snapshotCompany.company_name,
      ready: blockers.length === 0,
      blockers,
      checks,
    }
  })

  const companies_ready = companies.filter((row) => row.ready).length
  const companies_evaluated = companies.length

  return {
    companies_evaluated,
    companies_ready,
    readiness_pct:
      companies_evaluated > 0 ? Math.round((companies_ready / companies_evaluated) * 100) : 0,
    companies,
  }
}
