/** Apollo Full Pipeline enrollment resolution helpers — client-safe pure functions. */

import type { ApolloEnrollmentAutomationReport } from "@/lib/growth/apollo/apollo-enrollment-automation-types"
import type { ApolloFullPipelineQualificationThresholdSource } from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"

export type ApolloFullPipelineCertificationScoredContact = {
  contact: ApolloPrimaryContactOperatorReviewRow
  qualification_score: number
}

export function selectSequenceReadyContactForEnrollment(
  contacts: ApolloPrimaryContactOperatorReviewRow[],
): ApolloPrimaryContactOperatorReviewRow | null {
  return (
    contacts.find((contact) => contact.sequence_ready && contact.contactable) ??
    contacts.find((contact) => contact.sequence_ready) ??
    null
  )
}

export function isCertificationEligibleSequenceReadyContact(
  contact: ApolloPrimaryContactOperatorReviewRow,
): boolean {
  return contact.sequence_ready && contact.contactable && contact.blockers.length === 0
}

export function selectSequenceReadyContactForCertification(
  scoredContacts: ApolloFullPipelineCertificationScoredContact[],
  input: {
    production_threshold: number
    certification_threshold: number
  },
): {
  contact: ApolloPrimaryContactOperatorReviewRow
  qualification_score: number
  threshold_used: number
  threshold_source: ApolloFullPipelineQualificationThresholdSource
} | null {
  const eligible = scoredContacts
    .filter((row) => isCertificationEligibleSequenceReadyContact(row.contact))
    .sort((left, right) => right.qualification_score - left.qualification_score)

  const productionQualified = eligible.filter(
    (row) => row.qualification_score >= input.production_threshold,
  )
  if (productionQualified[0]) {
    return {
      contact: productionQualified[0].contact,
      qualification_score: productionQualified[0].qualification_score,
      threshold_used: input.production_threshold,
      threshold_source: "production",
    }
  }

  const certificationQualified = eligible.filter(
    (row) => row.qualification_score >= input.certification_threshold,
  )
  if (certificationQualified[0]) {
    return {
      contact: certificationQualified[0].contact,
      qualification_score: certificationQualified[0].qualification_score,
      threshold_used: input.certification_threshold,
      threshold_source: "certification_override",
    }
  }

  return null
}

export function pickEnrollmentCandidateIdFromAutomationReport(
  report: ApolloEnrollmentAutomationReport | null | undefined,
  input?: {
    company_contact_id?: string | null
    contact_candidate_id?: string | null
  },
): string | null {
  if (!report || report.candidates.length === 0) return null

  const companyContactId = input?.company_contact_id?.trim() || null
  const contactCandidateId = input?.contact_candidate_id?.trim() || null

  const matched =
    report.candidates.find(
      (candidate) =>
        (companyContactId && candidate.company_contact_id === companyContactId) ||
        (contactCandidateId && candidate.contact_candidate_id === contactCandidateId),
    ) ?? report.candidates[0]

  return matched?.candidate_id ?? null
}

export function describeEnrollmentDuplicatePreventionDecision(
  report: ApolloEnrollmentAutomationReport | null | undefined,
): string | null {
  if (!report) return null
  if (report.candidates_created > 0) return "created_new_candidate"
  if (report.candidates.length > 0) return "reused_existing_candidate"
  if (report.candidates_skipped_duplicate > 0) return "reused_pending_duplicate"
  if (report.candidates_skipped_re_enrollment > 0) return "skipped_re_enrollment_without_reuse"
  if (report.contacts_qualified === 0) return "no_qualified_contacts"
  return "no_candidate_materialized"
}
