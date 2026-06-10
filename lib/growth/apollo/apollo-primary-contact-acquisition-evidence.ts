/** Apollo-Primary-1 contact acquisition evidence — client-safe. */

import type { ApolloTieredPeopleSearchEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloVerifiedEmailPromotionEvidence } from "@/lib/growth/apollo/apollo-verified-email-promotion-evidence"

export const APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER =
  "apollo-primary-contact-acquisition-evidence-v1" as const

export type ApolloPrimaryContactAcquisitionCompanyEvidence = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  canonical_company_id: string | null
  apollo_search_attempted: boolean
  apollo_search_skipped_reason: string | null
  apollo_people_found: number
  existing_contacts_reused: number
  existing_contactable_before: number
  enrichment_attempted: boolean
  enrichment_skipped_reason: string | null
  enrichment_candidates_updated: number
  credits_consumed: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  blockers: string[]
  search_strategy: ApolloTieredPeopleSearchEvidence | null
  verified_email_promotion: ApolloVerifiedEmailPromotionEvidence | null
}

export type ApolloPrimaryContactAcquisitionEvidence = {
  qa_marker: typeof APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER
  acquired_at: string
  mock: boolean
  companies_searched: number
  apollo_people_found: number
  existing_contacts_reused: number
  enrichment_attempted: number
  enrichment_skipped: number
  credits_consumed: number
  promoted_contacts: number
  contactable_contacts: number
  sequence_ready_contacts: number
  auto_enrollment: false
  outreach_sent: false
  blockers: string[]
  companies: ApolloPrimaryContactAcquisitionCompanyEvidence[]
  runtime: {
    duration_ms: number
    api_calls: number
    errors: string[]
  }
}

export function emptyApolloPrimaryContactAcquisitionEvidence(
  mock: boolean,
): ApolloPrimaryContactAcquisitionEvidence {
  return {
    qa_marker: APOLLO_PRIMARY_CONTACT_ACQUISITION_EVIDENCE_QA_MARKER,
    acquired_at: new Date().toISOString(),
    mock,
    companies_searched: 0,
    apollo_people_found: 0,
    existing_contacts_reused: 0,
    enrichment_attempted: 0,
    enrichment_skipped: 0,
    credits_consumed: 0,
    promoted_contacts: 0,
    contactable_contacts: 0,
    sequence_ready_contacts: 0,
    auto_enrollment: false,
    outreach_sent: false,
    blockers: [],
    companies: [],
    runtime: { duration_ms: 0, api_calls: 0, errors: [] },
  }
}
