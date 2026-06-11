/** Apollo production yield benchmark failure classification — client-safe. */

import type { ApolloProductionYieldFailureCategory } from "@/lib/growth/apollo/apollo-production-yield-benchmark-types"

export type ApolloProductionYieldFailureInput = {
  raw_contacts_returned: number
  mapped_contacts: number
  partial_identity_evidence: {
    mapped_partial_identity_contacts: number
    partial_identity_enrichment_attempted: boolean
    partial_identity_enrichment_resolved: number
  }
  current_run_apollo_verified_email_contacts: number
  current_run_apollo_promoted_contacts: number
  current_run_apollo_contactable_contacts: number
  current_run_apollo_sequence_ready_contacts: number
}

export function classifyCompanyFailure(
  row: ApolloProductionYieldFailureInput,
): ApolloProductionYieldFailureCategory | null {
  const raw = row.raw_contacts_returned
  const mapped = row.mapped_contacts
  const partial = row.partial_identity_evidence.mapped_partial_identity_contacts
  const verified = row.current_run_apollo_verified_email_contacts
  const promoted = row.current_run_apollo_promoted_contacts
  const contactable = row.current_run_apollo_contactable_contacts
  const sequenceReady = row.current_run_apollo_sequence_ready_contacts

  if (sequenceReady > 0) return null
  if (contactable > 0) return "sequence_readiness_failed"
  if (promoted > 0) return "contactability_failed"
  if (verified > 0) return "promotion_failed"
  if (mapped > 0) return "no_verified_email"
  if (
    partial > 0 &&
    row.partial_identity_evidence.partial_identity_enrichment_attempted &&
    row.partial_identity_evidence.partial_identity_enrichment_resolved === 0
  ) {
    return "partial_identity_unresolved"
  }
  if (raw > 0 && mapped === 0) return "mapper_rejected"
  if (raw === 0) return "zero_raw"
  return "zero_raw"
}
