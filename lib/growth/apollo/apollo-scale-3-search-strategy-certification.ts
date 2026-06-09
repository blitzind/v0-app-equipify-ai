/** Apollo-Scale-3 — tiered search strategy certification (same cohort as Scale-2). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  certifyApolloScale2LiveAcquisition,
  resolveApolloScale2LiveCohort,
  type ApolloScale2CertResult,
  type ApolloScale2CompanyEvidenceRow,
  type ApolloScale2LiveAcquisitionCertification,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"

export const APOLLO_SCALE_3_QA_MARKER = "apollo-scale-3-search-strategy-cert-v1" as const

export type ApolloScale3CompanyEvidenceRow = ApolloScale2CompanyEvidenceRow & {
  tier_used: number
  raw_contacts_returned: number
  mapped_contacts: number
  mapping_rejections: number
  rejection_reasons: Record<string, number>
  tier_attempts: ApolloSearchTierAttemptEvidence[]
  contacts_enriched: number
  contacts_promoted: number
  contactable: number
  sequence_ready: number
  legacy_fallback_used: boolean
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
  }
  certification: ApolloScale2LiveAcquisitionCertification
}

export function mapApolloScale3CompanyEvidenceRow(input: {
  base: ApolloScale2CompanyEvidenceRow
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
}): ApolloScale3CompanyEvidenceRow {
  const strategy = input.acquisition?.search_strategy
  return {
    ...input.base,
    tier_used: strategy?.tier_used ?? 0,
    raw_contacts_returned: strategy?.raw_contacts_returned ?? 0,
    mapped_contacts: strategy?.mapped_contacts ?? input.base.contacts_found,
    mapping_rejections: strategy?.mapping_rejections ?? 0,
    rejection_reasons: strategy?.rejection_reasons ?? {},
    tier_attempts: strategy?.tier_attempts ?? [],
    contacts_enriched: input.base.contacts_enriched,
    contacts_promoted: input.base.contacts_promoted,
    contactable: input.base.contactable_contacts,
    sequence_ready: input.base.sequence_ready_contacts,
    legacy_fallback_used: strategy?.legacy_fallback_used ?? false,
  }
}

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
  for (const row of companies) {
    if (row.tier_used === 1) tierCounts.tier_1 += 1
    if (row.tier_used === 2) tierCounts.tier_2 += 1
    if (row.tier_used === 3) tierCounts.tier_3 += 1
    if (row.tier_used === 4) tierCounts.tier_4 += 1
    if (row.mapped_contacts > 0) tierCounts.mapped += 1
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
    aggregate: {
      ...scale2.aggregate,
      tier_1_companies: tierCounts.tier_1,
      tier_2_companies: tierCounts.tier_2,
      tier_3_companies: tierCounts.tier_3,
      tier_4_companies: tierCounts.tier_4,
      companies_with_apollo_mapped_contacts: tierCounts.mapped,
    },
    certification: scale2,
  }
}

export { resolveApolloScale2LiveCohort }
