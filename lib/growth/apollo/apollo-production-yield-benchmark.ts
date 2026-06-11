/** Apollo production yield benchmark — greenfield acquisition economics, no outreach. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runApolloPrimaryContactAcquisition } from "@/lib/growth/apollo/apollo-primary-contact-acquisition"
import { resolveApolloPrimaryContactAcquisitionContactLimit } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import {
  mapApolloScale3CompanyEvidenceRow,
  type ApolloScale3MappedCompanyEvidenceRow,
} from "@/lib/growth/apollo/apollo-scale-3-company-promotion-evidence"
import {
  resolveApolloProductionYieldBenchmarkCohort,
  type ApolloProductionYieldBenchmarkCohortCompany,
  type ApolloProductionYieldBenchmarkCohortResolution,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-cohort"
import { classifyCompanyFailure } from "@/lib/growth/apollo/apollo-production-yield-benchmark-classify"
import {
  APOLLO_PRODUCTION_YIELD_BENCHMARK_ID,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER,
  type ApolloProductionYieldBenchmarkReport,
  type ApolloProductionYieldBenchmarkCompanyRow,
  type ApolloProductionYieldFailureAnalysis,
  type ApolloProductionYieldFailureCategory,
  type ApolloProductionYieldSegmentBucket,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-types"
import { APOLLO_SEARCH_TIER_NAMES } from "@/lib/growth/providers/apollo/apollo-query-builder"
import type { ApolloSearchTier } from "@/lib/growth/providers/apollo/apollo-query-builder"
import { isApolloMockEnabled } from "@/lib/growth/providers/apollo/apollo-config"
import {
  beginApolloRunGuardrails,
  getApolloRunGuardrailSnapshot,
  resetApolloRunGuardrails,
} from "@/lib/growth/providers/apollo/apollo-run-guardrails"

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

function emptyFailureAnalysis(): ApolloProductionYieldFailureAnalysis {
  return {
    zero_raw: [],
    mapper_rejected: [],
    partial_identity_unresolved: [],
    no_verified_email: [],
    promotion_failed: [],
    contactability_failed: [],
    sequence_readiness_failed: [],
  }
}

function resolveTitleTierLabel(tier_used: number | null): string | null {
  if (!tier_used || tier_used < 1 || tier_used > 5) return null
  const tier = tier_used as ApolloSearchTier
  const name = APOLLO_SEARCH_TIER_NAMES[tier]
  return name.startsWith("A_")
    ? "A"
    : name.startsWith("B_")
      ? "B"
      : name.startsWith("C_")
        ? "C"
        : name.startsWith("D_")
          ? "D"
          : name.startsWith("E_")
            ? "E"
            : String(tier_used)
}

function mapBenchmarkCompanyRow(input: {
  cohort: ApolloProductionYieldBenchmarkCohortCompany
  mapped: ApolloScale3MappedCompanyEvidenceRow
}): ApolloProductionYieldBenchmarkCompanyRow {
  const failure_category = classifyCompanyFailure({
    raw_contacts_returned: input.mapped.raw_contacts_returned,
    mapped_contacts: input.mapped.mapped_contacts,
    partial_identity_evidence: input.mapped.partial_identity_evidence,
    current_run_apollo_verified_email_contacts: input.mapped.current_run_apollo_verified_email_contacts,
    current_run_apollo_promoted_contacts: input.mapped.current_run_apollo_promoted_contacts,
    current_run_apollo_contactable_contacts: input.mapped.current_run_apollo_contactable_contacts,
    current_run_apollo_sequence_ready_contacts: input.mapped.current_run_apollo_sequence_ready_contacts,
  })
  return {
    company_candidate_id: input.cohort.company_candidate_id,
    company_name: input.cohort.company_name,
    domain: input.cohort.domain,
    state: input.cohort.state,
    industry: input.cohort.industry,
    domain_present: input.cohort.domain_present,
    domain_alias_used: input.mapped.domain_aliases_used.length > 0,
    title_tier_winner: resolveTitleTierLabel(input.mapped.tier_used),
    raw_people_count: input.mapped.raw_contacts_returned,
    mapped_contacts: input.mapped.mapped_contacts,
    partial_identity_contacts: input.mapped.partial_identity_evidence.mapped_partial_identity_contacts,
    verified_email_contacts: input.mapped.current_run_apollo_verified_email_contacts,
    promoted_contacts: input.mapped.current_run_apollo_promoted_contacts,
    contactable_contacts: input.mapped.current_run_apollo_contactable_contacts,
    sequence_ready_contacts: input.mapped.current_run_apollo_sequence_ready_contacts,
    historical_revalidated_contacts: input.mapped.historical_revalidated_contacts_found,
    failure_category,
    blockers: input.mapped.blockers,
  }
}

function buildSegmentBuckets(
  companies: ApolloProductionYieldBenchmarkCompanyRow[],
  keyFn: (row: ApolloProductionYieldBenchmarkCompanyRow) => string,
): ApolloProductionYieldSegmentBucket[] {
  const buckets = new Map<string, ApolloProductionYieldSegmentBucket>()
  for (const company of companies) {
    const key = keyFn(company)
    const bucket = buckets.get(key) ?? {
      key,
      companies: 0,
      sequence_ready_contacts: 0,
      verified_email_contacts: 0,
      mapped_contacts: 0,
      sequence_ready_per_company: null,
    }
    bucket.companies += 1
    bucket.sequence_ready_contacts += company.sequence_ready_contacts
    bucket.verified_email_contacts += company.verified_email_contacts
    bucket.mapped_contacts += company.mapped_contacts
    buckets.set(key, bucket)
  }
  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      sequence_ready_per_company: safeRatio(bucket.sequence_ready_contacts, bucket.companies),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

function buildFailureAnalysis(
  companies: ApolloProductionYieldBenchmarkCompanyRow[],
): ApolloProductionYieldFailureAnalysis {
  const analysis = emptyFailureAnalysis()
  for (const company of companies) {
    if (!company.failure_category) continue
    analysis[company.failure_category].push(company.company_name)
  }
  return analysis
}

function buildPlanRecommendation(input: {
  company_limit: number
  companies_processed: number
  sequence_ready_contacts: number
  economics: ApolloProductionYieldBenchmarkReport["economics"]
  top_blockers: ApolloProductionYieldBenchmarkReport["top_blockers"]
}): ApolloProductionYieldBenchmarkReport["recommendation"] {
  const seqPer100 = input.economics.sequence_ready_contacts_per_100_companies ?? 0
  const creditsPerSeq = input.economics.estimated_cost_per_sequence_ready_contact ?? 0
  const benchmark_passed_for_scale =
    input.companies_processed >= 50 &&
    input.sequence_ready_contacts >= 10 &&
    seqPer100 >= 5 &&
    input.top_blockers[0]?.count < input.companies_processed * 0.6

  const monthly_credit_sizing_notes: string[] = []
  if (creditsPerSeq > 0 && seqPer100 > 0) {
    const creditsPer100Companies = creditsPerSeq * seqPer100
    monthly_credit_sizing_notes.push(
      `At current yield (~${seqPer100} sequence-ready per 100 companies), expect ~${creditsPer100Companies} credits per 100-company greenfield batch.`,
    )
    monthly_credit_sizing_notes.push(
      `For ~500 sequence-ready contacts/month, budget ~${Math.ceil((500 / seqPer100) * creditsPer100Companies)} Apollo credits before overhead.`,
    )
  } else {
    monthly_credit_sizing_notes.push(
      "Insufficient sequence-ready yield to size monthly credits — rerun after search/mapper fixes.",
    )
  }

  const apollo_plan_notes: string[] = []
  if (benchmark_passed_for_scale) {
    apollo_plan_notes.push(
      "50-company greenfield benchmark shows repeatable sequence-ready yield — optional 100-company confirmation run is appropriate.",
    )
    if (input.company_limit < 100) {
      apollo_plan_notes.push(
        "Next step: execute 100-company benchmark with GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_COMPANY_LIMIT=100.",
      )
    }
  } else {
    apollo_plan_notes.push(
      "Hold scale outreach until greenfield yield improves — prioritize top blockers before increasing company_limit.",
    )
  }
  if (creditsPerSeq >= 3) {
    apollo_plan_notes.push(
      "High credits per sequence-ready contact — review enrichment batching and title-tier stop rules before large cohorts.",
    )
  }

  return {
    benchmark_passed_for_scale,
    suggested_next_company_limit: benchmark_passed_for_scale && input.company_limit < 100 ? 100 : null,
    estimated_credits_per_100_sequence_ready_contacts:
      seqPer100 > 0 && creditsPerSeq > 0 ? Math.ceil(creditsPerSeq * seqPer100) : null,
    monthly_credit_sizing_notes,
    apollo_plan_notes,
  }
}

function mapScale3RowFromAcquisition(
  cohort: ApolloProductionYieldBenchmarkCohortCompany,
  acquisition: ApolloPrimaryContactAcquisitionCompanyEvidence,
): ApolloScale3MappedCompanyEvidenceRow {
  const base = {
    company_candidate_id: cohort.company_candidate_id,
    company_name: cohort.company_name,
    domain: cohort.domain ?? "",
    search_attempted: acquisition.apollo_search_attempted,
    contacts_found: acquisition.apollo_people_found,
    contacts_enriched: acquisition.enrichment_candidates_updated,
    contacts_promoted: acquisition.promoted_contacts,
    contactable_contacts: acquisition.contactable_contacts,
    sequence_ready_contacts: acquisition.sequence_ready_contacts,
    blockers: acquisition.blockers,
    error: null,
    failed: acquisition.blockers.length > 0 && acquisition.sequence_ready_contacts === 0,
  }
  return mapApolloScale3CompanyEvidenceRow({ base, acquisition })
}

export async function runApolloProductionYieldBenchmark(
  admin: SupabaseClient,
  input: {
    execution_id: string
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    cohort_resolution?: ApolloProductionYieldBenchmarkCohortResolution
  },
): Promise<ApolloProductionYieldBenchmarkReport> {
  const env = input.env ?? process.env
  const started = Date.now()
  const mock = isApolloMockEnabled(env)
  const cohort_resolution =
    input.cohort_resolution ??
    (await resolveApolloProductionYieldBenchmarkCohort(admin, {
      company_limit: input.company_limit,
      env,
    }))
  const company_limit = cohort_resolution.company_limit
  const contact_limit =
    input.contact_limit ?? resolveApolloPrimaryContactAcquisitionContactLimit(env)

  beginApolloRunGuardrails()

  const acquisition = await runApolloPrimaryContactAcquisition(admin, {
    company_candidate_ids: cohort_resolution.selected.map((row) => row.company_candidate_id),
    contact_limit,
    created_by: input.created_by ?? null,
    env,
    skip_apollo_search_if_existing_contactable: false,
    certification_mode: "greenfield",
  })

  const guardrails = getApolloRunGuardrailSnapshot()
  resetApolloRunGuardrails()

  const cohortById = new Map(
    cohort_resolution.selected.map((row) => [row.company_candidate_id, row] as const),
  )
  const acquisitionById = new Map(
    acquisition.companies.map((company) => [company.company_candidate_id, company] as const),
  )

  const benchmarkCompanies: ApolloProductionYieldBenchmarkCompanyRow[] = []
  for (const cohortCompany of cohort_resolution.selected) {
    const acquisitionCompany =
      acquisitionById.get(cohortCompany.company_candidate_id) ??
      ({
        company_candidate_id: cohortCompany.company_candidate_id,
        company_name: cohortCompany.company_name,
        domain: cohortCompany.domain,
        canonical_company_id: cohortCompany.canonical_company_id,
        apollo_search_attempted: false,
        apollo_search_skipped_reason: "acquisition_evidence_missing",
        apollo_people_found: 0,
        existing_contacts_reused: 0,
        existing_contactable_before: 0,
        enrichment_attempted: false,
        enrichment_skipped_reason: "acquisition_evidence_missing",
        enrichment_candidates_updated: 0,
        email_enrichment: {
          candidates_selected: 0,
          candidates_updated: 0,
          verified_status_without_email_selected: 0,
          channel_less_selected: 0,
          skipped_reason: "acquisition_evidence_missing",
          error: null,
          error_stage: null,
        },
        credits_consumed: 0,
        promoted_contacts: 0,
        contactable_contacts: 0,
        sequence_ready_contacts: 0,
        blockers: ["acquisition_evidence_missing"],
        search_strategy: null,
        apollo_search_evidence: null,
        verified_email_promotion: null,
        apollo_persisted_this_run: 0,
        current_run_attribution: null,
        partial_identity_evidence: null,
        search_debug: null,
        enrichment_evidence: null,
      } satisfies ApolloPrimaryContactAcquisitionCompanyEvidence)

    const mapped = mapScale3RowFromAcquisition(cohortCompany, acquisitionCompany)
    benchmarkCompanies.push(
      mapBenchmarkCompanyRow({ cohort: cohortCompany, mapped }),
    )
  }

  const aggregate = {
    companies_processed: benchmarkCompanies.length,
    companies_with_raw_people: benchmarkCompanies.filter((row) => row.raw_people_count > 0).length,
    companies_with_mapped_people: benchmarkCompanies.filter((row) => row.mapped_contacts > 0).length,
    raw_people_count: benchmarkCompanies.reduce((sum, row) => sum + row.raw_people_count, 0),
    mapped_contacts: benchmarkCompanies.reduce((sum, row) => sum + row.mapped_contacts, 0),
    partial_identity_contacts: benchmarkCompanies.reduce(
      (sum, row) => sum + row.partial_identity_contacts,
      0,
    ),
    verified_email_contacts: benchmarkCompanies.reduce(
      (sum, row) => sum + row.verified_email_contacts,
      0,
    ),
    promoted_contacts: benchmarkCompanies.reduce((sum, row) => sum + row.promoted_contacts, 0),
    contactable_contacts: benchmarkCompanies.reduce((sum, row) => sum + row.contactable_contacts, 0),
    sequence_ready_contacts: benchmarkCompanies.reduce(
      (sum, row) => sum + row.sequence_ready_contacts,
      0,
    ),
    contacts_per_company: safeRatio(
      benchmarkCompanies.reduce((sum, row) => sum + row.mapped_contacts, 0),
      benchmarkCompanies.length,
    ),
    verified_emails_per_company: safeRatio(
      benchmarkCompanies.reduce((sum, row) => sum + row.verified_email_contacts, 0),
      benchmarkCompanies.length,
    ),
    sequence_ready_per_company: safeRatio(
      benchmarkCompanies.reduce((sum, row) => sum + row.sequence_ready_contacts, 0),
      benchmarkCompanies.length,
    ),
  }

  const search_api_calls = guardrails?.search_api_calls ?? acquisition.runtime.api_calls
  const enrichment_api_calls = guardrails?.bulk_match_batches ?? 0
  const estimated_credits_consumed =
    guardrails?.credits_estimate ?? acquisition.credits_consumed

  const economics = {
    apollo_search_api_calls: search_api_calls,
    enrichment_api_calls,
    estimated_credits_consumed,
    sequence_ready_contacts_per_100_companies: safeRatio(
      aggregate.sequence_ready_contacts * 100,
      aggregate.companies_processed,
    ),
    estimated_cost_per_sequence_ready_contact: safeRatio(
      estimated_credits_consumed,
      aggregate.sequence_ready_contacts,
    ),
    credits_per_company: safeRatio(estimated_credits_consumed, aggregate.companies_processed),
  }

  const failure_analysis = buildFailureAnalysis(benchmarkCompanies)
  const top_blockers = Object.entries(failure_analysis)
    .map(([category, examples]) => ({
      category: category as ApolloProductionYieldFailureCategory,
      count: examples.length,
      examples: examples.slice(0, 5),
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)

  const recommendation = buildPlanRecommendation({
    company_limit,
    companies_processed: aggregate.companies_processed,
    sequence_ready_contacts: aggregate.sequence_ready_contacts,
    economics,
    top_blockers,
  })

  return {
    qa_marker: APOLLO_PRODUCTION_YIELD_BENCHMARK_QA_MARKER,
    benchmark_id: APOLLO_PRODUCTION_YIELD_BENCHMARK_ID,
    execution_id: input.execution_id,
    certified_at: new Date().toISOString(),
    certification_mode: "greenfield",
    company_limit,
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      enrollment_confirmed: false,
      execution_approved: false,
      scheduler_ran: false,
      draft_created: false,
      sequence_scheduled: false,
    },
    aggregate,
    economics,
    segments: {
      domain_present: buildSegmentBuckets(benchmarkCompanies, (row) =>
        row.domain_present ? "domain_present" : "domain_missing",
      ),
      domain_alias_used: buildSegmentBuckets(benchmarkCompanies, (row) =>
        row.domain_alias_used ? "domain_alias_used" : "primary_domain_only",
      ),
      title_tier_winner: buildSegmentBuckets(
        benchmarkCompanies,
        (row) => row.title_tier_winner ?? "no_tier_winner",
      ),
      company_category: buildSegmentBuckets(
        benchmarkCompanies,
        (row) => row.industry?.trim() || "category_unknown",
      ),
      state_location: buildSegmentBuckets(
        benchmarkCompanies,
        (row) => row.state?.trim() || "location_unknown",
      ),
    },
    failure_analysis,
    top_blockers,
    companies: benchmarkCompanies,
    recommendation,
    runtime: {
      duration_ms: Date.now() - started,
      mock,
      errors: acquisition.runtime.errors,
    },
  }
}
