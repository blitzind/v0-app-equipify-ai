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
  normalizeApollo25CompanyPilotSkipReason,
  type Apollo25CompanyPilotSelectionMode,
  type Apollo25CompanyPilotSkipReason,
} from "@/lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
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
  growth_lead_id?: string | null
  has_active_sequence_enrollment: boolean
  in_active_pilot_cohort: boolean
  has_execution_ready_candidate?: boolean
  has_account_playbook?: boolean
  company_intelligence_present?: boolean
  buying_committee_present?: boolean
}

export type Apollo25CompanyPilotCompanyEligibilitySignals = {
  suppression_conflict: boolean
  active_pilot_conflict: boolean
  missing_company_contact: boolean
  missing_growth_lead: boolean
  missing_required_identity: boolean
  materialization_not_ready: boolean
  has_verified_email: boolean
  has_sequence_ready: boolean
  qualification_below_threshold: boolean
}

export type Apollo25CompanyPilotCompanyEligibilityAnalysis = {
  eligible: boolean
  skip_reason: Apollo25CompanyPilotSkipReason | null
  raw_reason: string | null
  contact: ApolloPrimaryContactOperatorReviewRow | null
  score: number
  signals: Apollo25CompanyPilotCompanyEligibilitySignals
}

function resolveSuppressionStatus(
  contact: ApolloPrimaryContactOperatorReviewRow,
): "clear" | "suppressed" | "unsubscribe_risk" {
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

function evaluateReEnrollmentForInput(
  input: Apollo25CompanyPilotSelectionInput,
  mode: Apollo25CompanyPilotSelectionMode,
): { blocked: boolean; code: string | null } {
  if (mode === "existing_pipeline_revalidation") {
    if (input.enrollment_status === "enrollment_approved") {
      if (!input.growth_lead_id) {
        return { blocked: true, code: "missing_growth_lead" }
      }
      if (!input.has_execution_ready_candidate && !input.has_account_playbook) {
        return { blocked: true, code: "materialization_not_ready" }
      }
      return { blocked: false, code: null }
    }

    if (input.has_active_sequence_enrollment) {
      return { blocked: true, code: "active_enrollment_exists" }
    }
    return { blocked: false, code: null }
  }

  return evaluateApolloEnrollmentReEnrollmentBlock({
    existing_status: input.enrollment_status,
    growth_lead_id: input.growth_lead_id ?? null,
    has_active_enrollment: input.has_active_sequence_enrollment,
  })
}

function scoreContacts(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
): ApolloFullPipelineCertificationScoredContact[] {
  return input.contacts.map((contact) => {
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
}

function buildSignals(
  input: Apollo25CompanyPilotSelectionInput,
  scored: ApolloFullPipelineCertificationScoredContact[],
  productionThreshold: number,
): Apollo25CompanyPilotCompanyEligibilitySignals {
  const hasContactLinkage = input.contacts.some(
    (contact) => contact.company_contact_id || contact.contact_candidate_id,
  )
  const hasIdentity = input.contacts.some((contact) => contact.full_name.trim().length > 0)
  const hasVerified = input.snapshot_summary.verified_email_contacts > 0
  const hasSequenceReady = input.snapshot_summary.sequence_ready_contacts > 0
  const maxScore = scored.reduce((max, row) => Math.max(max, row.qualification_score), 0)
  const eligibleAboveThreshold = scored.some(
    (row) =>
      row.contact.sequence_ready &&
      row.contact.contactable &&
      row.contact.blockers.length === 0 &&
      row.qualification_score >= productionThreshold,
  )

  const suppressionConflict = input.contacts.some(
    (contact) =>
      contact.sequence_ready &&
      contact.contactable &&
      hasVerifiedEmail(contact) &&
      resolveSuppressionStatus(contact) !== "clear",
  )

  return {
    suppression_conflict: suppressionConflict,
    active_pilot_conflict: input.in_active_pilot_cohort,
    missing_company_contact: !hasContactLinkage,
    missing_growth_lead:
      input.enrollment_status === "enrollment_approved" && !input.growth_lead_id,
    missing_required_identity: !hasIdentity || !hasContactLinkage,
    materialization_not_ready:
      input.enrollment_status === "enrollment_approved" &&
      !input.has_execution_ready_candidate &&
      !input.has_account_playbook,
    has_verified_email: hasVerified,
    has_sequence_ready: hasSequenceReady,
    qualification_below_threshold: hasSequenceReady && !eligibleAboveThreshold && maxScore > 0,
  }
}

function failAnalysis(
  skip_reason: Apollo25CompanyPilotSkipReason,
  raw_reason: string,
  signals: Apollo25CompanyPilotCompanyEligibilitySignals,
  score = 0,
): Apollo25CompanyPilotCompanyEligibilityAnalysis {
  return {
    eligible: false,
    skip_reason,
    raw_reason,
    contact: null,
    score,
    signals,
  }
}

export function analyzeApollo25CompanyPilotCompanyEligibility(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
  mode: Apollo25CompanyPilotSelectionMode,
): Apollo25CompanyPilotCompanyEligibilityAnalysis {
  const scored = scoreContacts(input, productionThreshold)
  const signals = buildSignals(input, scored, productionThreshold)

  if (signals.active_pilot_conflict) {
    return failAnalysis("active_pilot_conflict", "company_in_active_pilot_cohort", signals)
  }

  const reEnrollment = evaluateReEnrollmentForInput(input, mode)
  if (reEnrollment.blocked) {
    return failAnalysis(
      normalizeApollo25CompanyPilotSkipReason(reEnrollment.code ?? "active_enrollment_conflict"),
      reEnrollment.code ?? "enrollment_conflict",
      signals,
    )
  }

  if (signals.suppression_conflict) {
    return failAnalysis("suppression_conflict", "suppression_conflict", signals)
  }

  if (signals.missing_required_identity) {
    return failAnalysis("missing_required_identity", "missing_apollo_contact_evidence", signals)
  }

  if (!signals.has_verified_email) {
    return failAnalysis("no_verified_email", "verified_email_missing", signals)
  }

  if (!signals.has_sequence_ready) {
    return failAnalysis("not_sequence_ready", "not_sequence_ready", signals)
  }

  const picked = selectSequenceReadyContactForCertification(scored, {
    production_threshold: productionThreshold,
    certification_threshold: productionThreshold,
  })

  if (!picked) {
    if (signals.qualification_below_threshold) {
      return failAnalysis(
        "qualification_below_threshold",
        "no_sequence_ready_contact_above_threshold",
        signals,
        scored.reduce((max, row) => Math.max(max, row.qualification_score), 0),
      )
    }
    return failAnalysis("not_sequence_ready", "not_sequence_ready", signals)
  }

  if (!hasVerifiedEmail(picked.contact)) {
    return failAnalysis("no_verified_email", "verified_email_missing", signals, picked.qualification_score)
  }

  const suppression = resolveSuppressionStatus(picked.contact)
  if (suppression !== "clear") {
    return failAnalysis("suppression_conflict", `suppression_${suppression}`, signals, picked.qualification_score)
  }

  return {
    eligible: true,
    skip_reason: null,
    raw_reason: "production_rules_passed",
    contact: picked.contact,
    score: picked.qualification_score,
    signals,
  }
}

export function evaluateApollo25CompanyPilotEligibility(
  input: Apollo25CompanyPilotSelectionInput,
  productionThreshold: number,
  mode: Apollo25CompanyPilotSelectionMode = "greenfield",
): {
  eligible: boolean
  reason: string
  contact: ApolloPrimaryContactOperatorReviewRow | null
  score: number
} {
  const analysis = analyzeApollo25CompanyPilotCompanyEligibility(input, productionThreshold, mode)
  return {
    eligible: analysis.eligible,
    reason: analysis.raw_reason ?? analysis.skip_reason ?? "ineligible",
    contact: analysis.contact,
    score: analysis.score,
  }
}

export function selectApollo25CompanyPilotCandidates(
  inputs: Apollo25CompanyPilotSelectionInput[],
  options?: {
    target_count?: number
    production_threshold?: number
    pilot_selection_mode?: Apollo25CompanyPilotSelectionMode
  },
): Apollo25CompanyPilotSelectionReport {
  const target_count = options?.target_count ?? APOLLO_25_COMPANY_PILOT_TARGET_COUNT
  const production_threshold = options?.production_threshold ?? 70
  const pilot_selection_mode = options?.pilot_selection_mode ?? "greenfield"

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
        skip_reason: "duplicate_company_in_pool",
      })
      continue
    }
    seenCompanyIds.add(companyId)

    const analysis = analyzeApollo25CompanyPilotCompanyEligibility(
      input,
      production_threshold,
      pilot_selection_mode,
    )

    if (!analysis.eligible || !analysis.contact) {
      skipped.push({
        company_candidate_id: input.company_candidate_id,
        company_name: input.company_name,
        reason: analysis.raw_reason ?? analysis.skip_reason ?? "ineligible",
        skip_reason: analysis.skip_reason ?? "missing_required_identity",
      })
      continue
    }

    eligible.push({
      company_candidate_id: input.company_candidate_id,
      company_name: input.company_name,
      domain: input.domain,
      selected_contact: toSelectedContact(analysis.contact, analysis.score),
      qualification_score: analysis.score,
      sequence_ready_status: analysis.contact.sequence_ready,
      suppression_status: resolveSuppressionStatus(analysis.contact),
      selection_reason: analysis.raw_reason ?? "production_rules_passed",
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
    pilot_selection_mode,
    selected,
    skipped,
  }
}
