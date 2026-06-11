/** 25-company pilot cohort selection — production rules, client-safe. */

import { evaluateApolloEnrollmentReEnrollmentBlock } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import type { ApolloEnrollmentCandidateStatus } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import { evaluateApolloEnrollmentQualification } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import {
  selectSequenceReadyContactForCertification,
  type ApolloFullPipelineCertificationScoredContact,
} from "@/lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import {
  APOLLO_25_COMPANY_PILOT_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
  type Apollo25CompanyPilotSelectionReport,
  type Apollo25CompanyPilotSelectedContact,
  type Apollo25CompanyPilotSelectionRow,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

export type Apollo25CompanyPilotSelectionInput = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  contacts: ApolloPrimaryContactOperatorReviewRow[]
  snapshot_summary: {
    mapped_contacts: number
    verified_email_contacts: number
    contactable_contacts: number
    sequence_ready_contacts: number
  }
  enrollment_status: ApolloEnrollmentCandidateStatus | null
  has_active_sequence_enrollment: boolean
  in_active_pilot_cohort: boolean
  company_intelligence_present?: boolean
  buying_committee_present?: boolean
}

function resolveSuppressionStatus(contact: ApolloPrimaryContactOperatorReviewRow): "clear" | "suppressed" | "unsubscribe_risk" {
  const blockers = contact.blockers.join(" ").toLowerCase()
  if (
    blockers.includes("suppression") ||
    blockers.includes("suppressed") ||
    contact.email_status === "suppressed" ||
    contact.phone_status === "suppressed"
  ) {
    return "suppressed"
  }
  if (blockers.includes("unsubscribe") || blockers.includes("opt-out") || blockers.includes("opt out")) {
    return "unsubscribe_risk"
  }
  return "clear"
}

function hasVerifiedEmail(contact: ApolloPrimaryContactOperatorReviewRow): boolean {
  return contact.email_status === "verified" || contact.channel_availability.email
}

function toSelectedContact(
  contact: ApolloPrimaryContactOperatorReviewRow,
  qualification_score: number,
): Apollo25CompanyPilotSelectedContact {
  const verified = hasVerifiedEmail(contact)
  return {
    full_name: contact.full_name,
    title: contact.title,
    company_contact_id: contact.company_contact_id,
    contact_candidate_id: contact.contact_candidate_id,
    verified_email_status: verified
      ? contact.email_status === "verified"
        ? "verified"
        : "available"
      : "missing",
    sequence_ready: contact.sequence_ready,
    qualification_score,
    suppression_status: resolveSuppressionStatus(contact),
  }
}

export function evaluateApollo25CompanyPilotEligibility(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
): { eligible: boolean; reason: string; contact: ApolloPrimaryContactOperatorReviewRow | null; score: number } {
  if (input.in_active_pilot_cohort) {
    return { eligible: false, reason: "company_in_active_pilot_cohort", contact: null, score: 0 }
  }

  const reEnrollment = evaluateApolloEnrollmentReEnrollmentBlock({
    existing_status: input.enrollment_status,
    growth_lead_id: null,
    has_active_enrollment: input.has_active_sequence_enrollment,
  })
  if (reEnrollment.blocked) {
    return { eligible: false, reason: reEnrollment.code ?? "enrollment_conflict", contact: null, score: 0 }
  }

  const suppressedReady = input.contacts.filter(
    (contact) =>
      contact.sequence_ready &&
      contact.contactable &&
      hasVerifiedEmail(contact) &&
      resolveSuppressionStatus(contact) !== "clear",
  )
  if (suppressedReady.length > 0) {
    return {
      eligible: false,
      reason: `suppression_${resolveSuppressionStatus(suppressedReady[0])}`,
      contact: null,
      score: 0,
    }
  }

  const scored: ApolloFullPipelineCertificationScoredContact[] = input.contacts.map((contact) => {
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
    return { contact, qualification_score: qualification.qualification_score }
  })

  const picked = selectSequenceReadyContactForCertification(scored, {
    production_threshold: productionThreshold,
    certification_threshold: productionThreshold,
  })

  if (!picked) {
    return { eligible: false, reason: "no_sequence_ready_contact_above_threshold", contact: null, score: 0 }
  }

  if (!hasVerifiedEmail(picked.contact)) {
    return { eligible: false, reason: "verified_email_missing", contact: null, score: 0 }
  }

  const suppression = resolveSuppressionStatus(picked.contact)
  if (suppression !== "clear") {
    return { eligible: false, reason: `suppression_${suppression}`, contact: null, score: 0 }
  }

  return {
    eligible: true,
    reason: "production_rules_passed",
    contact: picked.contact,
    score: picked.qualification_score,
  }
}

export function selectApollo25CompanyPilotCandidates(
  inputs: Apollo25CompanyPilotSelectionInput[],
  options?: {
    target_count?: number
    production_threshold?: number
  },
): Apollo25CompanyPilotSelectionReport {
  const target_count = options?.target_count ?? APOLLO_25_COMPANY_PILOT_TARGET_COUNT
  const production_threshold = options?.production_threshold ?? 70

  const eligible: Apollo25CompanyPilotSelectionRow[] = []
  const skipped: Apollo25CompanyPilotSelectionReport["skipped"] = []
  const seenCompanyIds = new Set<string>()

  for (const input of inputs) {
    const companyId = input.company_candidate_id.trim()
    if (!companyId) continue
    if (seenCompanyIds.has(companyId)) {
      skipped.push({
        company_candidate_id: companyId,
        company_name: input.company_name,
        reason: "duplicate_company_in_pool",
      })
      continue
    }
    seenCompanyIds.add(companyId)

    const result = evaluateApollo25CompanyPilotEligibility(input, production_threshold)
    if (!result.eligible || !result.contact) {
      skipped.push({
        company_candidate_id: input.company_candidate_id,
        company_name: input.company_name,
        reason: result.reason,
      })
      continue
    }

    eligible.push({
      company_candidate_id: input.company_candidate_id,
      company_name: input.company_name,
      domain: input.domain,
      selected_contact: toSelectedContact(result.contact, result.score),
      qualification_score: result.score,
      sequence_ready_status: result.contact.sequence_ready,
      suppression_status: resolveSuppressionStatus(result.contact),
      selection_reason: result.reason,
    })
  }

  eligible.sort((a, b) => b.qualification_score - a.qualification_score)
  const selected = eligible.slice(0, target_count)

  return {
    qa_marker: APOLLO_25_COMPANY_PILOT_QA_MARKER,
    target_count,
    selected_count: selected.length,
    eligible_pool_count: eligible.length,
    production_qualification_threshold: production_threshold,
    selected,
    skipped,
  }
}
