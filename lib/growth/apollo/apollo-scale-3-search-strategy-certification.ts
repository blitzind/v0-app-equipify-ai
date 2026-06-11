/** Apollo-Scale-3 search strategy certification — same cohort + acquisition path as Scale-5. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  certifyApolloScale2LiveAcquisition,
  type ApolloScale2CertResult,
  type ApolloScale2CompanyEvidenceRow,
  type ApolloScale2LiveAcquisitionCertification,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import {
  resolveApolloScale3CertificationCohort,
  toApolloScale2LiveCohortShape,
  type ApolloScale3CertificationCohortResolution,
  type ApolloScale3CohortPreset,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort"
import {
  resolveApolloScale3CertificationMode,
  type ApolloScale3CertificationMode,
} from "@/lib/growth/apollo/apollo-certification-historical-revalidation"
import {
  buildApolloScale3CompanyPromotionEvidence,
  mapApolloScale3CompanyEvidenceRow,
  type ApolloScale3CompanyPromotionEvidence,
} from "@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import {
  buildApolloScale3CertificationAssessment,
  resolveApolloScale3CompanyCertificationFailReasons,
  type ApolloScale3CertificationAssessment,
} from "@/lib/growth/apollo/apollo-scale-3-certification-assessment"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import type { ApolloSearchTierAttemptEvidence } from "@/lib/growth/providers/apollo/apollo-tiered-people-search-types"

export const APOLLO_SCALE_3_QA_MARKER = "apollo-scale-3-search-strategy-cert-v3" as const

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
    tier_5_companies: number
    legacy_fallback_companies: number
    companies_with_apollo_mapped_contacts: number
    verified_email_contacts: number
    email_enrichment_candidates_updated: number
    company_contacts_promoted: number
    contactable_after_promotion: number
    legacy_contactable_contacts: number
    sequence_ready_after_promotion: number
    current_run_apollo_verified_email_contacts: number
    current_run_apollo_promoted_contacts: number
    current_run_apollo_contactable_contacts: number
    current_run_apollo_sequence_ready_contacts: number
    historical_apollo_verified_email_contacts: number
  }
  failure_analysis: ApolloScale2LiveAcquisitionCertification["failure_analysis"]
  certification_assessment: ApolloScale3CertificationAssessment
  certification: ApolloScale2LiveAcquisitionCertification
  cohort_selection: ApolloScale3CertificationCohortResolution
  certification_mode: ApolloScale3CertificationMode
}

export { mapApolloScale3CompanyEvidenceRow }
export { assessApolloScale3SearchStrategyResult } from "@/lib/growth/apollo/apollo-scale-3-certification-assessment"
export {
  buildApolloScale3CertificationAssessment,
  type ApolloScale3CertFailReason,
} from "@/lib/growth/apollo/apollo-scale-3-certification-assessment"

export async function certifyApolloScale3SearchStrategy(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    company_names?: string[]
    company_candidate_ids?: string[]
    cohort_preset?: ApolloScale3CohortPreset
    cohort_resolution?: ApolloScale3CertificationCohortResolution
    certification_mode?: ApolloScale3CertificationMode
  },
): Promise<ApolloScale3SearchStrategyCertification> {
  const env = input?.env ?? process.env
  const certification_mode = resolveApolloScale3CertificationMode({
    cohort_preset: input?.cohort_preset,
    certification_mode: input?.certification_mode,
  })
  const company_limit = Math.max(
    15,
    Math.min(
      20,
      input?.company_limit ??
        (Number.parseInt(env.GROWTH_APOLLO_SCALE_2_COMPANY_LIMIT ?? "15", 10) || 15),
    ),
  )
  const cohort_resolution =
    input?.cohort_resolution ??
    (await resolveApolloScale3CertificationCohort(admin, {
      company_limit,
      company_names: input?.company_names,
      company_candidate_ids: input?.company_candidate_ids,
      cohort_preset: input?.cohort_preset,
      env,
    }))

  const scale2 = await certifyApolloScale2LiveAcquisition(admin, {
    company_limit,
    contact_limit: input?.contact_limit,
    created_by: input?.created_by,
    env,
    cohort: toApolloScale2LiveCohortShape(cohort_resolution),
    certification_mode,
  })

  const acquisitionById = new Map(
    scale2.acquisition_companies.map((company) => [company.company_candidate_id, company] as const),
  )

  const companies = scale2.companies.map((base) =>
    mapApolloScale3CompanyEvidenceRow({
      base,
      acquisition: acquisitionById.get(base.company_candidate_id) ?? null,
    }),
  ).map((row) => ({
    ...row,
    certification_fail_reasons: resolveApolloScale3CompanyCertificationFailReasons(row),
  }))

  const tierCounts = {
    tier_1: 0,
    tier_2: 0,
    tier_3: 0,
    tier_4: 0,
    tier_5: 0,
    legacy_fallback: 0,
    mapped: 0,
  }
  let verified_email_contacts = 0
  let email_enrichment_candidates_updated = 0
  let company_contacts_promoted = 0
  let contactable_after_promotion = 0
  let legacy_contactable_contacts = 0
  let sequence_ready_after_promotion = 0
  let current_run_apollo_verified_email_contacts = 0
  let current_run_apollo_promoted_contacts = 0
  let current_run_apollo_contactable_contacts = 0
  let current_run_apollo_sequence_ready_contacts = 0
  let historical_apollo_verified_email_contacts = 0

  for (const row of companies) {
    if (row.tier_used === 1) tierCounts.tier_1 += 1
    if (row.tier_used === 2) tierCounts.tier_2 += 1
    if (row.tier_used === 3) tierCounts.tier_3 += 1
    if (row.tier_used === 4) tierCounts.tier_4 += 1
    if (row.tier_used === 5) tierCounts.tier_5 += 1
    if (row.legacy_fallback_used) tierCounts.legacy_fallback += 1
    if (row.mapped_contacts > 0) tierCounts.mapped += 1
    verified_email_contacts += row.promotion_evidence.verified_email_contacts
    email_enrichment_candidates_updated += row.promotion_evidence.email_enrichment_candidates_updated
    company_contacts_promoted += row.promotion_evidence.company_contacts_promoted
    contactable_after_promotion += row.promotion_evidence.current_run_apollo_contactable_contacts
    legacy_contactable_contacts += row.promotion_evidence.legacy_contactable_contacts
    sequence_ready_after_promotion += row.promotion_evidence.current_run_apollo_sequence_ready_contacts
    current_run_apollo_verified_email_contacts +=
      row.promotion_evidence.current_run_apollo_verified_email_contacts
    current_run_apollo_promoted_contacts += row.promotion_evidence.current_run_apollo_promoted_contacts
    current_run_apollo_contactable_contacts +=
      row.promotion_evidence.current_run_apollo_contactable_contacts
    current_run_apollo_sequence_ready_contacts +=
      row.promotion_evidence.current_run_apollo_sequence_ready_contacts
    historical_apollo_verified_email_contacts +=
      row.promotion_evidence.historical_apollo_verified_email_contacts
  }

  const certification_assessment = buildApolloScale3CertificationAssessment({
    companies,
    mock: scale2.runtime.mock,
    certification_mode,
  })

  return {
    qa_marker: APOLLO_SCALE_3_QA_MARKER,
    result: certification_assessment.result,
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
    certification_assessment,
    aggregate: {
      ...scale2.aggregate,
      contactable_contacts: current_run_apollo_contactable_contacts,
      sequence_ready_contacts: current_run_apollo_sequence_ready_contacts,
      tier_1_companies: tierCounts.tier_1,
      tier_2_companies: tierCounts.tier_2,
      tier_3_companies: tierCounts.tier_3,
      tier_4_companies: tierCounts.tier_4,
      tier_5_companies: tierCounts.tier_5,
      legacy_fallback_companies: tierCounts.legacy_fallback,
      companies_with_apollo_mapped_contacts: tierCounts.mapped,
      verified_email_contacts,
      email_enrichment_candidates_updated,
      company_contacts_promoted,
      contactable_after_promotion,
      legacy_contactable_contacts,
      sequence_ready_after_promotion,
      current_run_apollo_verified_email_contacts,
      current_run_apollo_promoted_contacts,
      current_run_apollo_contactable_contacts,
      current_run_apollo_sequence_ready_contacts,
      historical_apollo_verified_email_contacts,
    },
    certification: scale2,
    cohort_selection: cohort_resolution,
    certification_mode,
  }
}

export {
  resolveApolloScale3CertificationCohort,
  APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort"
export type {
  ApolloScale3CertificationCohortResolution,
  ApolloScale3CohortPreset,
  ApolloScale3CohortSelectionEvidenceRow,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort"
