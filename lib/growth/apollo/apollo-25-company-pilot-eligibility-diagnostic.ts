/** Eligibility funnel diagnostic for 25-company pilot — client-safe. */

import { evaluateApolloEnrollmentQualification } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { isCertificationEligibleSequenceReadyContact } from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import type { Apollo25CompanyPilotSelectionInput } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import {
  analyzeApollo25CompanyPilotCompanyEligibility,
  type Apollo25CompanyPilotCompanyEligibilityAnalysis,
} from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import {
  emptyApollo25CompanyPilotSkipReasonCounts,
  type Apollo25CompanyPilotSelectionMode,
} from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import {
  APOLLO_25_COMPANY_PILOT_QA_MARKER,
  type Apollo25CompanyPilotEligibilityDiagnostic,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

function hasVerifiedEmailContact(input: Apollo25CompanyPilotSelectionInput): boolean {
  return input.snapshot_summary.verified_email_contacts > 0
}

function hasSequenceReadyContact(input: Apollo25CompanyPilotSelectionInput): boolean {
  return input.snapshot_summary.sequence_ready_contacts > 0
}

function maxQualificationScore(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
): number {
  let max = 0
  for (const contact of input.contacts) {
    const qualification = evaluateApolloEnrollmentQualification(
      {
        mapped_contacts: input.snapshot_summary.mapped_contacts,
        verified_email_contacts: input.snapshot_summary.verified_email_contacts,
        contactable_contacts: input.snapshot_summary.contactable_contacts,
        sequence_ready_contacts: input.snapshot_summary.sequence_ready_contacts,
        company_intelligence_present: input.company_intelligence_present ?? true,
        buying_committee_present: input.buying_committee_present ?? false,
        buying_committee_coverage: null,
        fit_score: null,
        research_score: null,
        contact_sequence_ready: contact.sequence_ready,
        contact_contactable: contact.contactable,
        contact_blockers: contact.blockers,
        apollo_search_tier: null,
        verified_email_source: null,
        enrichment_source: null,
      },
      { threshold: productionThreshold },
    )
    if (qualification.qualification_score > max) max = qualification.qualification_score
  }
  return max
}

function hasQualificationAboveThreshold(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
): boolean {
  for (const contact of input.contacts) {
    if (!isCertificationEligibleSequenceReadyContact(contact)) continue
    const qualification = evaluateApolloEnrollmentQualification(
      {
        mapped_contacts: input.snapshot_summary.mapped_contacts,
        verified_email_contacts: input.snapshot_summary.verified_email_contacts,
        contactable_contacts: input.snapshot_summary.contactable_contacts,
        sequence_ready_contacts: input.snapshot_summary.sequence_ready_contacts,
        company_intelligence_present: input.company_intelligence_present ?? true,
        buying_committee_present: input.buying_committee_present ?? false,
        buying_committee_coverage: null,
        fit_score: null,
        research_score: null,
        contact_sequence_ready: contact.sequence_ready,
        contact_contactable: contact.contactable,
        contact_blockers: contact.blockers,
        apollo_search_tier: null,
        verified_email_source: null,
        enrichment_source: null,
      },
      { threshold: productionThreshold },
    )
    if (qualification.qualification_score >= productionThreshold) return true
  }
  return false
}

function hasSuppressionConflict(input: Apollo25CompanyPilotSelectionInput): boolean {
  return analyzeApollo25CompanyPilotCompanyEligibility(input, 70, "greenfield").signals.suppression_conflict
}

function isBlockedByReEnrollmentGreenfield(analysis: Apollo25CompanyPilotCompanyEligibilityAnalysis): boolean {
  return (
    analysis.skip_reason === "already_enrollment_approved" ||
    analysis.skip_reason === "active_enrollment_conflict"
  )
}

function isMissingLeadOrContactLinkage(input: Apollo25CompanyPilotSelectionInput): boolean {
  const hasContactId = input.contacts.some(
    (contact) => contact.company_contact_id || contact.contact_candidate_id,
  )
  if (!hasContactId) return true
  if (input.enrollment_status === "enrollment_approved" && !input.growth_lead_id) return true
  return false
}

function isMaterializationBlocked(input: Apollo25CompanyPilotSelectionInput): boolean {
  if (input.enrollment_status !== "enrollment_approved") return false
  return !input.has_execution_ready_candidate && !input.has_account_playbook
}

export function buildApollo25CompanyPilotRemediation(input: {
  diagnostic: Apollo25CompanyPilotEligibilityDiagnostic
  pilot_selection_mode: Apollo25CompanyPilotSelectionMode
}): string[] {
  const recommendations: string[] = []
  const { funnel_counts, skipped_reason_counts } = input.diagnostic

  if (funnel_counts.total_apollo_discovered_companies < input.diagnostic.target_count) {
    recommendations.push(
      "Run Apollo production yield benchmark (pnpm test:apollo-production-yield-benchmark) to add greenfield companies with verified contacts.",
    )
  }

  if (
    skipped_reason_counts.not_sequence_ready > 0 ||
    skipped_reason_counts.no_verified_email > 0 ||
    skipped_reason_counts.qualification_below_threshold > 0
  ) {
    recommendations.push(
      "Run Apollo primary contact acquisition + enrollment automation to promote sequence-ready contacts with verified email.",
    )
  }

  if (skipped_reason_counts.already_enrollment_approved > 0) {
    if (input.pilot_selection_mode === "greenfield") {
      recommendations.push(
        "Already-approved enrollment candidates are excluded in greenfield mode. Use existing_pipeline_revalidation only for pipeline resume (no duplicate enrollment).",
      )
      recommendations.push(
        "Review stale enrollment_approved rows: reject or archive if no longer valid before re-running greenfield selection.",
      )
    }
  }

  if (skipped_reason_counts.materialization_not_ready > 0) {
    recommendations.push(
      "Complete account playbook + sequence execution materialization for approved enrollments before revalidation cohort inclusion.",
    )
  }

  if (skipped_reason_counts.missing_growth_lead > 0 || skipped_reason_counts.missing_company_contact > 0) {
    recommendations.push(
      "Resolve growth lead linkage and company_contact promotion for Apollo contacts before pilot selection.",
    )
  }

  if (skipped_reason_counts.suppression_conflict > 0) {
    recommendations.push(
      "Suppressions cannot be bypassed. Remove blocked contacts from pilot pool or resolve suppression source.",
    )
  }

  if (funnel_counts.companies_eligible_greenfield === 0 && input.pilot_selection_mode === "greenfield") {
    recommendations.push(
      "No greenfield-eligible companies under production rules. Expand Apollo discovery before activating a 25-company pilot.",
    )
  }

  return recommendations
}

export function buildApollo25CompanyPilotEligibilityDiagnostic(
  inputs: Apollo25CompanyPilotSelectionInput[],
  options?: {
    production_threshold?: number
    pilot_selection_mode?: Apollo25CompanyPilotSelectionMode
    target_count?: number
    greenfield_eligible_count?: number
    revalidation_eligible_count?: number
  },
): Apollo25CompanyPilotEligibilityDiagnostic {
  const production_threshold = options?.production_threshold ?? 70
  const pilot_selection_mode = options?.pilot_selection_mode ?? "greenfield"
  const target_count = options?.target_count ?? 25
  const skipped_reason_counts = emptyApollo25CompanyPilotSkipReasonCounts()

  for (const input of inputs) {
    const modeAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
      input,
      production_threshold,
      pilot_selection_mode,
    )
    if (!modeAnalysis.eligible && modeAnalysis.skip_reason) {
      skipped_reason_counts[modeAnalysis.skip_reason] += 1
    }
  }

  let companies_with_verified_email = 0
  let companies_with_sequence_ready_contacts = 0
  let companies_with_qualification_score_gte_threshold = 0
  let companies_blocked_by_re_enrollment = 0
  let companies_blocked_by_suppression = 0
  let companies_blocked_by_active_pilot = 0
  let companies_blocked_by_missing_lead_contact_linkage = 0
  let companies_blocked_by_materialization_readiness = 0

  const sample_blocked_companies: Apollo25CompanyPilotEligibilityDiagnostic["sample_blocked_companies"] = []

  for (const input of inputs) {
    if (hasVerifiedEmailContact(input)) companies_with_verified_email += 1
    if (hasSequenceReadyContact(input)) companies_with_sequence_ready_contacts += 1
    if (hasQualificationAboveThreshold(input, production_threshold)) {
      companies_with_qualification_score_gte_threshold += 1
    }

    const greenfieldAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
      input,
      production_threshold,
      "greenfield",
    )
    const revalidationAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
      input,
      production_threshold,
      "existing_pipeline_revalidation",
    )

    if (hasSuppressionConflict(input)) companies_blocked_by_suppression += 1
    if (input.in_active_pilot_cohort) companies_blocked_by_active_pilot += 1
    if (isMissingLeadOrContactLinkage(input)) companies_blocked_by_missing_lead_contact_linkage += 1
    if (isMaterializationBlocked(input)) companies_blocked_by_materialization_readiness += 1
    if (isBlockedByReEnrollmentGreenfield(greenfieldAnalysis)) {
      companies_blocked_by_re_enrollment += 1
    }

    const modeAnalysis =
      pilot_selection_mode === "existing_pipeline_revalidation"
        ? revalidationAnalysis
        : greenfieldAnalysis

    if (!modeAnalysis.eligible && modeAnalysis.skip_reason) {
      if (sample_blocked_companies.length < 15) {
        sample_blocked_companies.push({
          company_candidate_id: input.company_candidate_id,
          company_name: input.company_name,
          primary_skip_reason: modeAnalysis.skip_reason,
          qualification_score: modeAnalysis.score,
          enrollment_status: input.enrollment_status,
        })
      }
    }
  }

  const companies_eligible_greenfield =
    options?.greenfield_eligible_count ??
    inputs.filter(
      (input) =>
        analyzeApollo25CompanyPilotCompanyEligibility(input, production_threshold, "greenfield").eligible,
    ).length

  const companies_eligible_revalidation =
    options?.revalidation_eligible_count ??
    inputs.filter(
      (input) =>
        analyzeApollo25CompanyPilotCompanyEligibility(
          input,
          production_threshold,
          "existing_pipeline_revalidation",
        ).eligible,
    ).length

  const diagnostic: Apollo25CompanyPilotEligibilityDiagnostic = {
    qa_marker: APOLLO_25_COMPANY_PILOT_QA_MARKER,
    target_count,
    production_qualification_threshold: production_threshold,
    pilot_selection_mode,
    funnel_counts: {
      total_apollo_discovered_companies: inputs.length,
      companies_with_verified_email,
      companies_with_sequence_ready_contacts,
      companies_with_qualification_score_gte_threshold,
      companies_blocked_by_re_enrollment,
      companies_blocked_by_suppression,
      companies_blocked_by_active_pilot,
      companies_blocked_by_missing_lead_contact_linkage,
      companies_blocked_by_materialization_readiness,
      companies_eligible_greenfield,
      companies_eligible_revalidation,
    },
    skipped_reason_counts,
    sample_blocked_companies,
    remediation: [],
  }

  diagnostic.remediation = buildApollo25CompanyPilotRemediation({
    diagnostic,
    pilot_selection_mode,
  })

  return diagnostic
}
