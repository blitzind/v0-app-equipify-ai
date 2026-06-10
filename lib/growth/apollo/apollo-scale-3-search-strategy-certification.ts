/** Apollo-Scale-3 search strategy certification — same cohort + acquisition path as Scale-5. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  certifyApolloScale2LiveAcquisition,
  resolveApolloScale2LiveCohort,
  type ApolloScale2CertResult,
  type ApolloScale2CompanyEvidenceRow,
  type ApolloScale2LiveAcquisitionCertification,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import {
  buildApolloScale3CompanyPromotionEvidence,
  mapApolloScale3CompanyEvidenceRow,
  type ApolloScale3CompanyPromotionEvidence,
} from "@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export const APOLLO_SCALE_3_QA_MARKER = "apollo-scale-3-search-strategy-cert-v2" as const

export type ApolloScale3CompanyEvidenceRow = import("@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence").ApolloScale3MappedCompanyEvidenceRow & {
  error_metadata: ApolloScale2CompanyEvidenceRow["error_metadata"]
  apollo_response_status: ApolloScale2CompanyEvidenceRow["apollo_response_status"]
}

export type ApolloScale3SearchStrategyCertification = {
  qa_marker: typeof APOLLO_SCALE_3_QA_MARKER
  result: ApolloScale2CertResult
  certified_at: string
  mode: "live_apollo_tiered_search"
  safety: {
    auto_enrollment: false
    outreach_sent: false
    scheduler_run: false
    execution_created: false
  }
  companies: ApolloScale3CompanyEvidenceRow[]
  aggregate: ApolloScale2LiveAcquisitionCertification["aggregate"] & {
    tier_1_companies: number
    tier_2_companies: number
    tier_3_companies: number
    tier_4_companies: number
    companies_with_apollo_mapped_contacts: number
    verified_email_contacts: number
    email_enrichment_candidates_updated: number
    company_contacts_promoted: number
    contactable_after_promotion: number
    sequence_ready_after_promotion: number
  }
  failure_analysis: ApolloScale2LiveAcquisitionCertification["failure_analysis"]
  certification: ApolloScale2LiveAcquisitionCertification
}

export { mapApolloScale3CompanyEvidenceRow }

export async function certifyApolloScale3SearchStrategy(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale3SearchStrategyCertification> {
  const scale2 = await certifyApolloScale2LiveAcquisition(admin, input)

  const acquisitionById = new Map(
    scale2.acquisition_companies.map((company) => [company.company_candidate_id, company] as const),
  )

  const companies = scale2.companies.map((base) =>
    mapApolloScale3CompanyEvidenceRow({
      base,
      acquisition: acquisitionById.get(base.company_candidate_id) ?? null,
    }),
  )

  const tierCounts = { tier_1: 0, tier_2: 0, tier_3: 0, tier_4: 0, mapped: 0 }
  let verified_email_contacts = 0
  let email_enrichment_candidates_updated = 0
  let company_contacts_promoted = 0
  let contactable_after_promotion = 0
  let sequence_ready_after_promotion = 0

  for (const row of companies) {
    if (row.tier_used === 1) tierCounts.tier_1 += 1
    if (row.tier_used === 2) tierCounts.tier_2 += 1
    if (row.tier_used === 3) tierCounts.tier_3 += 1
    if (row.tier_used === 4) tierCounts.tier_4 += 1
    if (row.mapped_contacts > 0) tierCounts.mapped += 1
    verified_email_contacts += row.promotion_evidence.verified_email_contacts
    email_enrichment_candidates_updated += row.promotion_evidence.email_enrichment_candidates_updated
    company_contacts_promoted += row.promotion_evidence.company_contacts_promoted
    contactable_after_promotion += row.promotion_evidence.contactable_after_promotion
    sequence_ready_after_promotion += row.promotion_evidence.sequence_ready_after_promotion
  }

  return {
    qa_marker: APOLLO_SCALE_3_QA_MARKER,
    result: scale2.result,
    certified_at: scale2.certified_at,
    mode: "live_apollo_tiered_search",
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      scheduler_run: false,
      execution_created: false,
    },
    companies,
    failure_analysis: scale2.failure_analysis,
    aggregate: {
      ...scale2.aggregate,
      tier_1_companies: tierCounts.tier_1,
      tier_2_companies: tierCounts.tier_2,
      tier_3_companies: tierCounts.tier_3,
      tier_4_companies: tierCounts.tier_4,
      companies_with_apollo_mapped_contacts: tierCounts.mapped,
      verified_email_contacts,
      email_enrichment_candidates_updated,
      company_contacts_promoted,
      contactable_after_promotion,
      sequence_ready_after_promotion,
    },
    certification: scale2,
  }
}

export { resolveApolloScale2LiveCohort }
