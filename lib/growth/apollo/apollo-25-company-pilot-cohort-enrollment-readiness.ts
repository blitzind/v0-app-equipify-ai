/** Apollo 25-company pilot cohort — enrollment readiness validation (Phase 14.2F). */

import {
  analyzeApollo25CompanyPilotCompanyEligibility,
  type Apollo25CompanyPilotSelectionInput,
} from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import type {
  Apollo25CompanyPilotCohortEnrollmentReadinessMode,
  Apollo25CompanyPilotCohortEnrollmentReadinessSummary,
  Apollo25CompanyPilotCohortSnapshotCompany,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export function resolveApollo25CompanyPilotCohortEnrollmentReadinessMode(input: {
  cohort_id?: string | null
  readiness_mode?: Apollo25CompanyPilotCohortEnrollmentReadinessMode
}): Apollo25CompanyPilotCohortEnrollmentReadinessMode {
  if (input.readiness_mode) return input.readiness_mode
  if (input.cohort_id?.trim()) return "persisted_cohort_review"
  return "preview_selection"
}

function toOtherActivePilotCompanyIds(
  value: ReadonlySet<string> | readonly string[] | undefined,
): Set<string> {
  if (!value) return new Set()
  if (value instanceof Set) return new Set(value)
  return new Set(value.map((id) => id.trim()).filter(Boolean))
}

function buildSelectionInputForReadinessAnalysis(
  selectionInput: Apollo25CompanyPilotSelectionInput,
  input: {
    readiness_mode: Apollo25CompanyPilotCohortEnrollmentReadinessMode
    company_candidate_id: string
    company_ids_in_other_active_pilot_cohorts: Set<string>
  },
): Apollo25CompanyPilotSelectionInput {
  if (input.readiness_mode !== "persisted_cohort_review") {
    return selectionInput
  }

  const inOtherActivePilotCohort = input.company_ids_in_other_active_pilot_cohorts.has(
    input.company_candidate_id.trim(),
  )

  return {
    ...selectionInput,
    in_active_pilot_cohort: inOtherActivePilotCohort,
  }
}

export function evaluateApollo25CompanyPilotCohortEnrollmentReadiness(input: {
  snapshot_companies: Apollo25CompanyPilotCohortSnapshotCompany[]
  selection_inputs: Apollo25CompanyPilotSelectionInput[]
  production_threshold?: number
  cohort_id?: string | null
  readiness_mode?: Apollo25CompanyPilotCohortEnrollmentReadinessMode
  company_ids_in_other_active_pilot_cohorts?: ReadonlySet<string> | readonly string[]
}): Apollo25CompanyPilotCohortEnrollmentReadinessSummary {
  const production_threshold = input.production_threshold ?? 70
  const readiness_mode = resolveApollo25CompanyPilotCohortEnrollmentReadinessMode({
    cohort_id: input.cohort_id,
    readiness_mode: input.readiness_mode,
  })
  const company_ids_in_other_active_pilot_cohorts = toOtherActivePilotCompanyIds(
    input.company_ids_in_other_active_pilot_cohorts,
  )
  const inputByCompany = new Map(
    input.selection_inputs.map((row) => [row.company_candidate_id.trim(), row]),
  )

  const companies = input.snapshot_companies.map((snapshotCompany) => {
    const company_candidate_id = snapshotCompany.company_candidate_id.trim()
    const selectionInput = inputByCompany.get(company_candidate_id)
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

    const snapshotQualificationPasses =
      snapshotCompany.qualification_score >= production_threshold

    if (selectionInput.enrollment_status === "enrollment_approved") {
      const checks = {
        verified_email: true,
        sequence_ready_contact: true,
        canonical_company_linkage: Boolean(selectionInput.canonical_company_id?.trim()),
        company_intelligence: Boolean(selectionInput.company_intelligence_present),
        qualification_gte_threshold:
          readiness_mode === "persisted_cohort_review"
            ? snapshotQualificationPasses
            : true,
        no_suppression_conflict: true,
        no_active_enrollment_conflict: true,
      }
      const blockers: string[] = []
      if (!checks.canonical_company_linkage) blockers.push("canonical_company_linkage")
      if (!checks.company_intelligence) blockers.push("company_intelligence")
      if (!selectionInput.growth_lead_id?.trim()) blockers.push("missing_growth_lead")
      if (!checks.qualification_gte_threshold) blockers.push("qualification_gte_threshold")

      return {
        company_candidate_id: snapshotCompany.company_candidate_id,
        company_name: snapshotCompany.company_name,
        ready: blockers.length === 0,
        blockers,
        checks,
      }
    }

    const selectionInputForAnalysis = buildSelectionInputForReadinessAnalysis(selectionInput, {
      readiness_mode,
      company_candidate_id,
      company_ids_in_other_active_pilot_cohorts,
    })

    const analysis = analyzeApollo25CompanyPilotCompanyEligibility(
      selectionInputForAnalysis,
      production_threshold,
      "greenfield",
    )

    const qualification_gte_threshold =
      readiness_mode === "persisted_cohort_review"
        ? snapshotQualificationPasses
        : analysis.score >= production_threshold && !analysis.signals.qualification_below_threshold

    const no_active_enrollment_conflict =
      readiness_mode === "persisted_cohort_review"
        ? !company_ids_in_other_active_pilot_cohorts.has(company_candidate_id) &&
          !selectionInput.has_active_sequence_enrollment
        : !analysis.signals.active_pilot_conflict && !selectionInput.has_active_sequence_enrollment

    const checks = {
      verified_email: analysis.signals.has_verified_email,
      sequence_ready_contact: analysis.signals.has_sequence_ready,
      canonical_company_linkage: Boolean(selectionInput.canonical_company_id?.trim()),
      company_intelligence: Boolean(selectionInput.company_intelligence_present),
      qualification_gte_threshold,
      no_suppression_conflict: !analysis.signals.suppression_conflict,
      no_active_enrollment_conflict,
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
    readiness_mode,
    companies,
  }
}
