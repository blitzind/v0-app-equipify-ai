/** Apollo-Scale-2 — live multi-company Apollo acquisition certification (no outreach). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { runApolloPrimaryContactAcquisition } from "@/lib/growth/apollo/apollo-primary-contact-acquisition"
import { resolveApolloPrimaryContactAcquisitionContactLimit } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"
import type { ApolloPrimaryContactAcquisitionCompanyEvidence } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-evidence"
import {
  buildApolloScale1CompanyResult,
  type ApolloScale1BlockerCategory,
  type ApolloScale1CompanyResult,
} from "@/lib/growth/apollo/apollo-scale-1-production-certification"

export const APOLLO_SCALE_2_QA_MARKER = "apollo-scale-2-live-acquisition-cert-v1" as const

/** Henry Schein — already certified; excluded from live scale cohort. */
export const APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS = [
  "d2e669d5-e912-4fb7-992a-b4f9a92ff56a",
] as const

export type ApolloScale2CertResult = "PASS" | "PASS_PARTIAL" | "FAIL"

export type ApolloScale2FailureCategory =
  | "no_email"
  | "no_phone"
  | "missing_person"
  | "canonical_failure"
  | "enrichment_failure"
  | "promotion_failure"
  | "suppression"
  | "low_confidence"
  | "other"

export type ApolloScale2LiveCohortCompany = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string
  domain: string
  industry: string | null
  prior_apollo_candidates: number
}

export type ApolloScale2CompanyEvidenceRow = {
  company_candidate_id: string
  company_name: string
  domain: string
  search_attempted: boolean
  contacts_found: number
  contacts_enriched: number
  contacts_promoted: number
  contactable_contacts: number
  sequence_ready_contacts: number
  blockers: string[]
  error: string | null
  error_metadata: {
    name: string | null
    stack: string | null
  } | null
  apollo_response_status: string
  failed: boolean
}

export type ApolloScale2FailureAnalysis = Record<ApolloScale2FailureCategory, string[]>

export type ApolloScale2LiveAcquisitionCertification = {
  qa_marker: typeof APOLLO_SCALE_2_QA_MARKER
  result: ApolloScale2CertResult
  certified_at: string
  mode: "live_apollo_acquisition"
  safety: {
    auto_enrollment: false
    outreach_sent: false
    enrollment_confirmed: false
    execution_approved: false
    scheduler_ran: false
  }
  cohort_selection: {
    companies_requested: number
    companies_selected: number
    excluded_henry_schein: true
    required: {
      canonical_company: true
      valid_domain: true
      no_prior_apollo_acquisition: true
    }
    selected: ApolloScale2LiveCohortCompany[]
    skipped_due_to_prior_apollo: number
    skipped_due_to_missing_domain: number
  }
  company_results: ApolloScale1CompanyResult[]
  companies: ApolloScale2CompanyEvidenceRow[]
  acquisition_companies: ApolloPrimaryContactAcquisitionCompanyEvidence[]
  failure_analysis: ApolloScale2FailureAnalysis
  aggregate: {
    companies_processed: number
    apollo_contacts_found: number
    apollo_contacts_enriched: number
    company_contacts_created: number
    contactable_contacts: number
    legacy_contactable_contacts: number
    sequence_ready_contacts: number
    search_to_enriched_pct: number | null
    search_to_contactable_pct: number | null
    search_to_sequence_ready_pct: number | null
    enrichment_success_pct: number | null
    promotion_success_pct: number | null
    canonical_resolution_success_pct: number | null
  }
  credit_efficiency: {
    apollo_credits_consumed: number
    contacts_per_credit: number | null
    contactable_contacts_per_credit: number | null
    sequence_ready_contacts_per_credit: number | null
    estimated_cost_per_sequence_ready_lead: number | null
  }
  failures_by_category: Record<ApolloScale2FailureCategory, number>
  failures_ranked: Array<{ category: ApolloScale2FailureCategory; count: number; examples: string[] }>
  henry_schein_baseline: {
    company_candidate_id: string
    contacts_found: 10
    contacts_enriched: 8
    contactable: 5
    sequence_ready: 5
    note: "Certified reference path — excluded from this live cohort run.",
  }
  recommendation: {
    ready_as_primary_engine: boolean
    expected_sequence_ready_yield_pct: number | null
    biggest_blockers: string[]
    answers: {
      is_apollo_ready_as_primary: string
      expected_sequence_ready_yield: string
      biggest_blockers_before_hundreds: string
    }
  }
  runtime: {
    duration_ms: number
    api_calls: number
    errors: string[]
    mock: boolean
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function pct(n: number, d: number): number | null {
  if (d <= 0) return null
  return Math.round((n / d) * 1000) / 10
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 1000
}

function emptyScale2FailureAnalysis(): ApolloScale2FailureAnalysis {
  return {
    no_email: [],
    no_phone: [],
    missing_person: [],
    canonical_failure: [],
    enrichment_failure: [],
    promotion_failure: [],
    suppression: [],
    low_confidence: [],
    other: [],
  }
}

function parseAcquisitionRuntimeErrors(
  errors: string[],
): Map<string, { message: string; name: string | null; stack: string | null }> {
  const byCompany = new Map<string, { message: string; name: string | null; stack: string | null }>()
  for (const entry of errors) {
    const separator = entry.indexOf(": ")
    if (separator <= 0) continue
    const company_candidate_id = entry.slice(0, separator).trim()
    const message = entry.slice(separator + 2).trim()
    if (!company_candidate_id) continue
    byCompany.set(company_candidate_id, { message, name: null, stack: null })
  }
  return byCompany
}

function serializeAcquisitionError(error: unknown): {
  message: string
  name: string | null
  stack: string | null
} {
  if (error instanceof Error) {
    return {
      message: error.message || "company_acquisition_failed",
      name: error.name ?? "Error",
      stack: error.stack ?? null,
    }
  }
  return {
    message: typeof error === "string" ? error : "company_acquisition_failed",
    name: null,
    stack: null,
  }
}

export function resolveApolloScale2ApolloResponseStatus(input: {
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
  exception_error?: string | null
}): string {
  if (input.exception_error) return "exception"
  const company = input.acquisition
  if (!company) return "missing"
  if (company.apollo_search_skipped_reason) return "skipped"
  if (company.blockers.some((blocker) => blocker.includes("apollo_search_failed"))) return "failed"
  if (company.blockers.includes("apollo_zero_contacts_mapped")) return "empty"
  if (company.apollo_search_attempted && company.apollo_people_found > 0) return "success"
  if (company.apollo_search_attempted) return "empty"
  return "not_attempted"
}

function buildFailedScale1CompanyResult(input: {
  cohort: ApolloScale2LiveCohortCompany
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
  error: string
}): ApolloScale1CompanyResult {
  const acquisition = input.acquisition
  const blockers = [...(acquisition?.blockers ?? []), input.error]

  return {
    company_name: input.cohort.company_name,
    company_candidate_id: input.cohort.company_candidate_id,
    canonical_company_id: acquisition?.canonical_company_id ?? input.cohort.canonical_company_id,
    industry: input.cohort.industry,
    acquisition: {
      apollo_contacts_found: acquisition?.apollo_people_found ?? 0,
      apollo_contacts_enriched: acquisition?.enrichment_candidates_updated ?? 0,
      emails_discovered: 0,
      phones_discovered: 0,
      linkedin_profiles_discovered: 0,
      credits_consumed: acquisition?.credits_consumed ?? 0,
      apollo_search_attempted: acquisition?.apollo_search_attempted ?? false,
      apollo_search_skipped_reason: acquisition?.apollo_search_skipped_reason ?? null,
      enrichment_attempted: acquisition?.enrichment_attempted ?? false,
      enrichment_skipped_reason: acquisition?.enrichment_skipped_reason ?? null,
      enrichment_candidates_updated: acquisition?.enrichment_candidates_updated ?? 0,
    },
    promotion: {
      contacts_promoted: acquisition?.promoted_contacts ?? 0,
      canonical_persons_created: 0,
      canonical_persons_matched: 0,
      canonical_company_matched: Boolean(acquisition?.canonical_company_id ?? input.cohort.canonical_company_id),
      company_contacts_created: acquisition?.promoted_contacts ?? 0,
    },
    readiness: {
      contactable_contacts: acquisition?.contactable_contacts ?? 0,
      sequence_ready_contacts: acquisition?.sequence_ready_contacts ?? 0,
      apollo_contactable_contacts: 0,
      legacy_contactable_contacts: acquisition?.existing_contactable_before ?? 0,
      blocked_contacts: 0,
      blockers_by_category: {
        no_email: 0,
        no_phone: 0,
        low_confidence: 0,
        missing_company: 0,
        missing_person: 0,
        suppression: 0,
        fatigue: 0,
        duplicate: 0,
        other: 0,
      },
    },
    company_blockers: blockers,
    failed: true,
    failure_reason: input.error,
  }
}

export function mapApolloScale2CompanyEvidenceRow(input: {
  cohort: ApolloScale2LiveCohortCompany
  result: ApolloScale1CompanyResult
  acquisition?: ApolloPrimaryContactAcquisitionCompanyEvidence | null
  error?: string | null
  error_metadata?: ApolloScale2CompanyEvidenceRow["error_metadata"]
}): ApolloScale2CompanyEvidenceRow {
  return {
    company_candidate_id: input.result.company_candidate_id,
    company_name: input.result.company_name,
    domain: input.cohort.domain,
    search_attempted: input.result.acquisition.apollo_search_attempted,
    contacts_found: input.result.acquisition.apollo_contacts_found,
    contacts_enriched: input.result.acquisition.apollo_contacts_enriched,
    contacts_promoted: input.result.promotion.contacts_promoted,
    contactable_contacts: input.result.readiness.contactable_contacts,
    sequence_ready_contacts: input.result.readiness.sequence_ready_contacts,
    blockers: [...input.result.company_blockers],
    error: input.error ?? input.result.failure_reason,
    error_metadata: input.error_metadata ?? null,
    apollo_response_status: resolveApolloScale2ApolloResponseStatus({
      acquisition: input.acquisition ?? null,
      exception_error: input.error_metadata ? input.error : null,
    }),
    failed: input.result.failed || Boolean(input.error ?? input.result.failure_reason),
  }
}

export function buildApolloScale2FailureAnalysis(input: {
  company_results: ApolloScale1CompanyResult[]
}): ApolloScale2FailureAnalysis {
  const analysis = emptyScale2FailureAnalysis()
  const seen = new Map<ApolloScale2FailureCategory, Set<string>>()

  function add(category: ApolloScale2FailureCategory, company_name: string): void {
    const names = seen.get(category) ?? new Set<string>()
    if (names.has(company_name)) return
    names.add(company_name)
    seen.set(category, names)
    analysis[category].push(company_name)
  }

  for (const company of input.company_results) {
    for (const blocker of company.company_blockers) {
      const mapped = mapCompanyBlockerToScale2(blocker)
      if (mapped) add(mapped, company.company_name)
    }
    for (const [category, count] of Object.entries(company.readiness.blockers_by_category)) {
      if (count <= 0) continue
      add(
        mapContactBlockerToScale2(category as ApolloScale1BlockerCategory),
        company.company_name,
      )
    }
    if (!company.canonical_company_id) add("canonical_failure", company.company_name)
    if (
      company.acquisition.enrichment_attempted &&
      company.acquisition.enrichment_candidates_updated === 0
    ) {
      add("enrichment_failure", company.company_name)
    }
    if (
      company.acquisition.apollo_search_attempted &&
      company.promotion.contacts_promoted === 0 &&
      company.acquisition.apollo_contacts_found > 0
    ) {
      add("promotion_failure", company.company_name)
    }
    if (company.failed && company.failure_reason) {
      add("other", company.company_name)
    }
  }

  return analysis
}

function emptyScale2FailureCounts(): Record<ApolloScale2FailureCategory, number> {
  return {
    no_email: 0,
    no_phone: 0,
    missing_person: 0,
    canonical_failure: 0,
    enrichment_failure: 0,
    promotion_failure: 0,
    suppression: 0,
    low_confidence: 0,
    other: 0,
  }
}

function mapContactBlockerToScale2(category: ApolloScale1BlockerCategory): ApolloScale2FailureCategory {
  if (category === "missing_company") return "canonical_failure"
  if (category === "duplicate") return "other"
  if (category === "fatigue") return "suppression"
  return category
}

function mapCompanyBlockerToScale2(blocker: string): ApolloScale2FailureCategory | null {
  const normalized = blocker.toLowerCase()
  if (normalized.includes("canonical")) return "canonical_failure"
  if (normalized.includes("enrich")) return "enrichment_failure"
  if (normalized.includes("promotion") || normalized.includes("sync")) return "promotion_failure"
  if (normalized.includes("apollo") && normalized.includes("fail")) return "other"
  if (normalized.includes("no_enriched_candidates")) return "enrichment_failure"
  return null
}

export async function resolveApolloScale2LiveCohort(
  admin: SupabaseClient,
  input: { limit: number; env?: NodeJS.ProcessEnv },
): Promise<{
  selected: ApolloScale2LiveCohortCompany[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_domain: number
}> {
  const limit = Math.max(15, Math.min(20, input.limit))
  const exclude = new Set<string>([
    ...APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS,
    ...(input.env?.GROWTH_APOLLO_SCALE_2_EXCLUDE_COMPANY_CANDIDATE_IDS?.split(",").map((s) => s.trim()) ?? []),
  ])

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  const canonicalIds = cohort?.company_ids?.slice(0, 200) ?? []

  type Row = {
    company_candidate_id: string
    company_name: string
    canonical_company_id: string
    domain: string
    industry: string | null
  }

  const eligibleRows: Row[] = []
  let skipped_due_to_missing_domain = 0

  function ingestDiscoveryRows(rows: unknown[] | null): void {
    for (const raw of rows ?? []) {
      const row = raw as Record<string, unknown>
      const company_candidate_id = asString(row.company_id)
      const canonical_company_id = asString(row.canonical_company_id)
      if (!company_candidate_id || !canonical_company_id) continue
      if (exclude.has(company_candidate_id)) continue

      const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
      if (!domain) {
        skipped_due_to_missing_domain += 1
        continue
      }

      eligibleRows.push({
        company_candidate_id,
        company_name: asString(row.company_name) || company_candidate_id,
        canonical_company_id,
        domain,
        industry: asString(row.industry) || null,
      })
    }
  }

  const discoverySelect =
    "company_id, company_name, canonical_company_id, industry, domain, website"

  if (canonicalIds.length > 0) {
    const { data: cohortCandidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select(discoverySelect)
      .in("canonical_company_id", canonicalIds)
      .not("canonical_company_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(Math.max(limit * 4, canonicalIds.length))
    ingestDiscoveryRows(cohortCandidates)
  }

  if (eligibleRows.length < limit) {
    const { data: fallbackCandidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select(discoverySelect)
      .not("canonical_company_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(limit * 6)
    ingestDiscoveryRows(fallbackCandidates)
  }

  const uniqueByCompany = new Map<string, Row>()
  for (const row of eligibleRows) {
    if (!uniqueByCompany.has(row.company_candidate_id)) {
      uniqueByCompany.set(row.company_candidate_id, row)
    }
  }

  const companyIds = [...uniqueByCompany.keys()]
  const priorApolloByCompany = new Map<string, number>()

  if (companyIds.length > 0) {
    const { data: apolloRows } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("company_candidate_id")
      .eq("provider_type", "future_apollo")
      .in("company_candidate_id", companyIds)

    for (const raw of apolloRows ?? []) {
      const id = asString((raw as Record<string, unknown>).company_candidate_id)
      if (!id) continue
      priorApolloByCompany.set(id, (priorApolloByCompany.get(id) ?? 0) + 1)
    }
  }

  const selected: ApolloScale2LiveCohortCompany[] = []
  let skipped_due_to_prior_apollo = 0

  for (const row of uniqueByCompany.values()) {
    const prior = priorApolloByCompany.get(row.company_candidate_id) ?? 0
    if (prior > 0) {
      skipped_due_to_prior_apollo += 1
      continue
    }
    selected.push({ ...row, prior_apollo_candidates: 0 })
    if (selected.length >= limit) break
  }

  if (selected.length < 15) {
    throw new Error(
      `Apollo-Scale-2 requires 15–20 companies with no prior Apollo acquisition; only ${selected.length} eligible (skipped_prior_apollo=${skipped_due_to_prior_apollo}, skipped_missing_domain=${skipped_due_to_missing_domain}).`,
    )
  }

  return { selected, skipped_due_to_prior_apollo, skipped_due_to_missing_domain }
}

function assessScale2Result(input: {
  aggregate: ApolloScale2LiveAcquisitionCertification["aggregate"]
  credit: ApolloScale2LiveAcquisitionCertification["credit_efficiency"]
  companies_processed: number
  mock: boolean
  runtime_errors: number
}): ApolloScale2CertResult {
  if (input.mock || input.companies_processed < 15) return "FAIL"

  const found = input.aggregate.apollo_contacts_found
  const seqReady = input.aggregate.sequence_ready_contacts
  const searchToSeq = input.aggregate.search_to_sequence_ready_pct ?? 0

  if (found >= 50 && seqReady >= 15 && searchToSeq >= 5 && input.runtime_errors <= 2) {
    return "PASS"
  }
  if (found >= 15 && seqReady >= 5) {
    return "PASS_PARTIAL"
  }
  if (found >= 1 && seqReady >= 1) {
    return "PASS_PARTIAL"
  }
  return "FAIL"
}

export function buildApolloScale2LiveAcquisitionCertification(input: {
  cohort: Awaited<ReturnType<typeof resolveApolloScale2LiveCohort>>
  company_results: ApolloScale1CompanyResult[]
  companies: ApolloScale2CompanyEvidenceRow[]
  acquisition_companies: ApolloPrimaryContactAcquisitionCompanyEvidence[]
  companies_requested: number
  acquisition: Awaited<ReturnType<typeof runApolloPrimaryContactAcquisition>>
  certified_at?: string
}): ApolloScale2LiveAcquisitionCertification {
  const failures_by_category = emptyScale2FailureCounts()
  const failureExamples = new Map<ApolloScale2FailureCategory, Set<string>>()

  for (const company of input.company_results) {
    for (const blocker of company.company_blockers) {
      const mapped = mapCompanyBlockerToScale2(blocker)
      if (!mapped) continue
      failures_by_category[mapped] += 1
      const examples = failureExamples.get(mapped) ?? new Set<string>()
      examples.add(company.company_name)
      failureExamples.set(mapped, examples)
    }
    for (const [category, count] of Object.entries(company.readiness.blockers_by_category)) {
      if (count <= 0) continue
      const mapped = mapContactBlockerToScale2(category as ApolloScale1BlockerCategory)
      failures_by_category[mapped] += count
      const examples = failureExamples.get(mapped) ?? new Set<string>()
      examples.add(company.company_name)
      failureExamples.set(mapped, examples)
    }
    if (!company.canonical_company_id) {
      failures_by_category.canonical_failure += 1
    }
    if (company.acquisition.enrichment_attempted && company.acquisition.enrichment_candidates_updated === 0) {
      failures_by_category.enrichment_failure += 1
    }
    if (company.acquisition.apollo_search_attempted && company.promotion.contacts_promoted === 0 && company.acquisition.apollo_contacts_found > 0) {
      failures_by_category.promotion_failure += 1
    }
  }

  const failures_ranked = Object.entries(failures_by_category)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({
      category: category as ApolloScale2FailureCategory,
      count,
      examples: [...(failureExamples.get(category as ApolloScale2FailureCategory) ?? [])].slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count)

  const apollo_contacts_found = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.apollo_contacts_found,
    0,
  )
  const apollo_contacts_enriched = input.company_results.reduce(
    (sum, row) => sum + row.acquisition.apollo_contacts_enriched,
    0,
  )
  const company_contacts_created = input.company_results.reduce(
    (sum, row) => sum + row.promotion.company_contacts_created,
    0,
  )
  const contactable_contacts = input.company_results.reduce(
    (sum, row) => sum + row.readiness.apollo_contactable_contacts,
    0,
  )
  const legacy_contactable_contacts = input.company_results.reduce(
    (sum, row) => sum + row.readiness.legacy_contactable_contacts,
    0,
  )
  const sequence_ready_contacts = input.company_results.reduce(
    (sum, row) => sum + row.readiness.sequence_ready_contacts,
    0,
  )
  const credits = input.acquisition.credits_consumed
  const companies_with_canonical = input.company_results.filter((row) => row.canonical_company_id).length

  const aggregate = {
    companies_processed: input.company_results.length,
    apollo_contacts_found,
    apollo_contacts_enriched,
    company_contacts_created,
    contactable_contacts,
    legacy_contactable_contacts,
    sequence_ready_contacts,
    search_to_enriched_pct: pct(apollo_contacts_enriched, apollo_contacts_found),
    search_to_contactable_pct: pct(contactable_contacts, apollo_contacts_found),
    search_to_sequence_ready_pct: pct(sequence_ready_contacts, apollo_contacts_found),
    enrichment_success_pct: pct(apollo_contacts_enriched, apollo_contacts_found),
    promotion_success_pct: pct(company_contacts_created, apollo_contacts_found),
    canonical_resolution_success_pct: pct(companies_with_canonical, input.company_results.length),
  }

  const credit_efficiency = {
    apollo_credits_consumed: credits,
    contacts_per_credit: safeRatio(apollo_contacts_found, credits),
    contactable_contacts_per_credit: safeRatio(contactable_contacts, credits),
    sequence_ready_contacts_per_credit: safeRatio(sequence_ready_contacts, credits),
    estimated_cost_per_sequence_ready_lead: safeRatio(credits, sequence_ready_contacts),
  }

  const result = assessScale2Result({
    aggregate,
    credit: credit_efficiency,
    companies_processed: input.company_results.length,
    mock: input.acquisition.mock,
    runtime_errors: input.acquisition.runtime.errors.length,
  })

  const biggest_blockers = failures_ranked.slice(0, 5).map((row) => `${row.category} (${row.count})`)
  const yieldPct = aggregate.search_to_sequence_ready_pct
  const failure_analysis = buildApolloScale2FailureAnalysis({ company_results: input.company_results })
  const companies = input.companies

  return {
    qa_marker: APOLLO_SCALE_2_QA_MARKER,
    result,
    certified_at: input.certified_at ?? new Date().toISOString(),
    mode: "live_apollo_acquisition",
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      enrollment_confirmed: false,
      execution_approved: false,
      scheduler_ran: false,
    },
    cohort_selection: {
      companies_requested: input.companies_requested,
      companies_selected: input.cohort.selected.length,
      excluded_henry_schein: true,
      required: {
        canonical_company: true,
        valid_domain: true,
        no_prior_apollo_acquisition: true,
      },
      selected: input.cohort.selected,
      skipped_due_to_prior_apollo: input.cohort.skipped_due_to_prior_apollo,
      skipped_due_to_missing_domain: input.cohort.skipped_due_to_missing_domain,
    },
    company_results: input.company_results,
    companies,
    acquisition_companies: input.acquisition_companies,
    failure_analysis,
    aggregate,
    credit_efficiency,
    failures_by_category,
    failures_ranked,
    henry_schein_baseline: {
      company_candidate_id: APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS[0]!,
      contacts_found: 10,
      contacts_enriched: 8,
      contactable: 5,
      sequence_ready: 5,
      note: "Certified reference path — excluded from this live cohort run.",
    },
    recommendation: {
      ready_as_primary_engine: result === "PASS",
      expected_sequence_ready_yield_pct: yieldPct,
      biggest_blockers,
      answers: {
        is_apollo_ready_as_primary:
          result === "PASS"
            ? "Yes — live multi-company run demonstrates repeatable sequence-ready yield at scale."
            : result === "PASS_PARTIAL"
              ? "Partially — Apollo acquisition works live but yield or blockers need tuning before primary-engine designation."
              : "No — live cohort did not produce sufficient sequence-ready contacts.",
        expected_sequence_ready_yield:
          yieldPct === null
            ? "Insufficient Apollo contacts found in cohort."
            : `Approximately ${yieldPct}% of Apollo contacts found reach sequence-ready (Henry Schein baseline: 50%).`,
        biggest_blockers_before_hundreds:
          biggest_blockers.length > 0 ? biggest_blockers.join("; ") : "No dominant blockers in cohort.",
      },
    },
    runtime: {
      duration_ms: input.acquisition.runtime.duration_ms,
      api_calls: input.acquisition.runtime.api_calls,
      errors: input.acquisition.runtime.errors,
      mock: input.acquisition.mock,
    },
  }
}

export async function certifyApolloScale2LiveAcquisition(
  admin: SupabaseClient,
  input?: {
    company_limit?: number
    contact_limit?: number
    created_by?: string | null
    env?: NodeJS.ProcessEnv
    cohort?: Awaited<ReturnType<typeof resolveApolloScale2LiveCohort>>
  },
): Promise<ApolloScale2LiveAcquisitionCertification> {
  const env = input?.env ?? process.env
  const company_limit = Math.max(
    15,
    Math.min(
      20,
      input?.company_limit ??
        (Number.parseInt(env.GROWTH_APOLLO_SCALE_2_COMPANY_LIMIT ?? "15", 10) || 15),
    ),
  )
  const contact_limit =
    input?.contact_limit ?? resolveApolloPrimaryContactAcquisitionContactLimit(env)

  const cohort =
    input?.cohort ??
    (await resolveApolloScale2LiveCohort(admin, { limit: company_limit, env }))

  const acquisition = await runApolloPrimaryContactAcquisition(admin, {
    company_candidate_ids: cohort.selected.map((row) => row.company_candidate_id),
    contact_limit,
    created_by: input?.created_by ?? null,
    env,
    skip_apollo_search_if_existing_contactable: false,
  })

  const metaById = new Map(
    cohort.selected.map((row) => [row.company_candidate_id, row] as const),
  )
  const acquisitionById = new Map(
    acquisition.companies.map((company) => [company.company_candidate_id, company] as const),
  )
  const runtimeErrors = parseAcquisitionRuntimeErrors(acquisition.runtime.errors)

  const company_results: ApolloScale1CompanyResult[] = []
  const companies: ApolloScale2CompanyEvidenceRow[] = []

  for (const cohortCompany of cohort.selected) {
    const acquisitionCompany = acquisitionById.get(cohortCompany.company_candidate_id) ?? null
    const runtimeError = runtimeErrors.get(cohortCompany.company_candidate_id) ?? null

    if (!acquisitionCompany && runtimeError) {
      const failed = buildFailedScale1CompanyResult({
        cohort: cohortCompany,
        error: runtimeError.message,
      })
      company_results.push(failed)
      companies.push(
        mapApolloScale2CompanyEvidenceRow({
          cohort: cohortCompany,
          result: failed,
          error: runtimeError.message,
          error_metadata: runtimeError,
        }),
      )
      continue
    }

    if (!acquisitionCompany) {
      const failed = buildFailedScale1CompanyResult({
        cohort: cohortCompany,
        error: "acquisition_company_evidence_missing",
      })
      company_results.push(failed)
      companies.push(
        mapApolloScale2CompanyEvidenceRow({
          cohort: cohortCompany,
          result: failed,
          error: failed.failure_reason,
        }),
      )
      continue
    }

    try {
      const result = await buildApolloScale1CompanyResult(admin, acquisitionCompany, {
        industry: cohortCompany.industry,
        company_name: cohortCompany.company_name,
      })
      if (runtimeError) {
        result.failed = true
        result.failure_reason = runtimeError.message
        result.company_blockers.push(runtimeError.message)
      }
      company_results.push(result)
      companies.push(
        mapApolloScale2CompanyEvidenceRow({
          cohort: cohortCompany,
          result,
          acquisition: acquisitionCompany,
          error: result.failure_reason,
          error_metadata: runtimeError,
        }),
      )
    } catch (error) {
      const serialized = serializeAcquisitionError(error)
      const failed = buildFailedScale1CompanyResult({
        cohort: cohortCompany,
        acquisition: acquisitionCompany,
        error: serialized.message,
      })
      company_results.push(failed)
      companies.push(
        mapApolloScale2CompanyEvidenceRow({
          cohort: cohortCompany,
          result: failed,
          acquisition: acquisitionCompany,
          error: serialized.message,
          error_metadata: serialized,
        }),
      )
    }
  }

  return buildApolloScale2LiveAcquisitionCertification({
    cohort,
    company_results,
    companies,
    acquisition_companies: acquisition.companies,
    companies_requested: company_limit,
    acquisition,
  })
}
