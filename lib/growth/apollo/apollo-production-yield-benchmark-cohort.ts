/** Apollo production yield benchmark — deterministic greenfield cohort selection. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS } from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"
import {
  normalizeApolloScale3CompanyName,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort-selection"
import {
  resolveApolloProductionYieldBenchmarkCompanyLimit,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-cohort-selection"

export const APOLLO_PRODUCTION_YIELD_BENCHMARK_COHORT_QA_MARKER =
  "apollo-production-yield-benchmark-cohort-v1" as const

export type ApolloProductionYieldBenchmarkCohortCompany = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string
  domain: string | null
  industry: string | null
  state: string | null
  city: string | null
  prior_apollo_candidates: number
  domain_present: boolean
}

export type ApolloProductionYieldCohortSelectionReason =
  | "deterministic_greenfield_no_prior_apollo"
  | "duplicate_company_name_skipped"
  | "duplicate_domain_skipped"
  | "excluded_company_candidate_id"

export type ApolloProductionYieldCohortSelectionEvidenceRow = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  selection_reason: ApolloProductionYieldCohortSelectionReason
  included: boolean
  skip_reason: string | null
  duplicate_of: string | null
}

export type ApolloProductionYieldBenchmarkCohortResolution = {
  qa_marker: typeof APOLLO_PRODUCTION_YIELD_BENCHMARK_COHORT_QA_MARKER
  company_limit: number
  selected: ApolloProductionYieldBenchmarkCohortCompany[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_canonical: number
  deduped_company_names: number
  deduped_domains: number
  cohort_selection_evidence: ApolloProductionYieldCohortSelectionEvidenceRow[]
}

type DiscoveryRow = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string
  domain: string | null
  industry: string | null
  state: string | null
  city: string | null
  domain_present: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function compareDiscoveryRows(a: DiscoveryRow, b: DiscoveryRow): number {
  const nameCompare = a.company_name.localeCompare(b.company_name, "en", { sensitivity: "base" })
  if (nameCompare !== 0) return nameCompare
  return a.company_candidate_id.localeCompare(b.company_candidate_id)
}

export { resolveApolloProductionYieldBenchmarkCompanyLimit } from "@/lib/growth/apollo/apollo-production-yield-benchmark-cohort-selection"

async function loadPriorApolloCounts(
  admin: SupabaseClient,
  companyIds: string[],
): Promise<Map<string, number>> {
  const priorApolloByCompany = new Map<string, number>()
  if (companyIds.length === 0) return priorApolloByCompany

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
  return priorApolloByCompany
}

function toCohortCompany(
  row: DiscoveryRow,
  prior_apollo_candidates: number,
): ApolloProductionYieldBenchmarkCohortCompany {
  return {
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    canonical_company_id: row.canonical_company_id,
    domain: row.domain,
    industry: row.industry,
    state: row.state,
    city: row.city,
    prior_apollo_candidates,
    domain_present: row.domain_present,
  }
}

async function loadGreenfieldDiscoveryPool(
  admin: SupabaseClient,
  input: { scan_limit: number; env?: NodeJS.ProcessEnv },
): Promise<{
  rows: DiscoveryRow[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_canonical: number
}> {
  const exclude = new Set<string>([
    ...APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS,
    ...(input.env?.GROWTH_APOLLO_SCALE_2_EXCLUDE_COMPANY_CANDIDATE_IDS?.split(",").map((s) => s.trim()) ??
      []),
  ])

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  const canonicalIds = cohort?.company_ids?.slice(0, 400) ?? []

  const eligibleRows: DiscoveryRow[] = []
  let skipped_due_to_missing_canonical = 0

  function ingestDiscoveryRows(rows: unknown[] | null): void {
    for (const raw of rows ?? []) {
      const row = raw as Record<string, unknown>
      const company_candidate_id = asString(row.company_id)
      const canonical_company_id = asString(row.canonical_company_id)
      if (!company_candidate_id) continue
      if (!canonical_company_id) {
        skipped_due_to_missing_canonical += 1
        continue
      }
      if (exclude.has(company_candidate_id)) continue

      const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
      eligibleRows.push({
        company_candidate_id,
        company_name: asString(row.company_name) || company_candidate_id,
        canonical_company_id,
        domain,
        industry: asString(row.industry) || null,
        state: asString(row.state) || null,
        city: asString(row.city) || null,
        domain_present: Boolean(domain),
      })
    }
  }

  const discoverySelect =
    "company_id, company_name, canonical_company_id, industry, domain, website, state, city"

  if (canonicalIds.length > 0) {
    const { data: cohortCandidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select(discoverySelect)
      .in("canonical_company_id", canonicalIds)
      .not("canonical_company_id", "is", null)
      .order("company_name", { ascending: true })
      .order("company_id", { ascending: true })
      .limit(Math.max(input.scan_limit * 4, canonicalIds.length))
    ingestDiscoveryRows(cohortCandidates)
  }

  if (eligibleRows.length < input.scan_limit) {
    const { data: fallbackCandidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select(discoverySelect)
      .not("canonical_company_id", "is", null)
      .order("company_name", { ascending: true })
      .order("company_id", { ascending: true })
      .limit(input.scan_limit * 8)
    ingestDiscoveryRows(fallbackCandidates)
  }

  const uniqueByCompany = new Map<string, DiscoveryRow>()
  for (const row of eligibleRows.sort(compareDiscoveryRows)) {
    if (!uniqueByCompany.has(row.company_candidate_id)) {
      uniqueByCompany.set(row.company_candidate_id, row)
    }
  }

  const priorApolloByCompany = await loadPriorApolloCounts(admin, [...uniqueByCompany.keys()])
  const rows: DiscoveryRow[] = []
  let skipped_due_to_prior_apollo = 0

  for (const row of [...uniqueByCompany.values()].sort(compareDiscoveryRows)) {
    const prior = priorApolloByCompany.get(row.company_candidate_id) ?? 0
    if (prior > 0) {
      skipped_due_to_prior_apollo += 1
      continue
    }
    rows.push(row)
  }

  return { rows, skipped_due_to_prior_apollo, skipped_due_to_missing_canonical }
}

export async function resolveApolloProductionYieldBenchmarkCohort(
  admin: SupabaseClient,
  input: {
    company_limit?: number
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloProductionYieldBenchmarkCohortResolution> {
  const company_limit = resolveApolloProductionYieldBenchmarkCompanyLimit(input)
  const pool = await loadGreenfieldDiscoveryPool(admin, {
    scan_limit: company_limit * 3,
    env: input.env,
  })

  const selected: ApolloProductionYieldBenchmarkCohortCompany[] = []
  const evidence: ApolloProductionYieldCohortSelectionEvidenceRow[] = []
  const seenNames = new Set<string>()
  const seenDomains = new Set<string>()
  let deduped_company_names = 0
  let deduped_domains = 0

  for (const row of pool.rows) {
    const normalizedName = normalizeApolloScale3CompanyName(row.company_name)
    if (seenNames.has(normalizedName)) {
      deduped_company_names += 1
      evidence.push({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
        selection_reason: "duplicate_company_name_skipped",
        included: false,
        skip_reason: "duplicate_company_name",
        duplicate_of: row.company_candidate_id,
      })
      continue
    }

    if (row.domain) {
      const domainKey = row.domain.toLowerCase()
      if (seenDomains.has(domainKey)) {
        deduped_domains += 1
        evidence.push({
          company_candidate_id: row.company_candidate_id,
          company_name: row.company_name,
          domain: row.domain,
          selection_reason: "duplicate_domain_skipped",
          included: false,
          skip_reason: "duplicate_domain",
          duplicate_of: row.company_candidate_id,
        })
        continue
      }
      seenDomains.add(domainKey)
    }

    seenNames.add(normalizedName)
    selected.push(toCohortCompany(row, 0))
    evidence.push({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
      selection_reason: "deterministic_greenfield_no_prior_apollo",
      included: true,
      skip_reason: null,
      duplicate_of: null,
    })

    if (selected.length >= company_limit) break
  }

  if (selected.length < company_limit) {
    throw new Error(
      `Apollo production yield benchmark requires ${company_limit} greenfield companies; only ${selected.length} eligible (skipped_prior_apollo=${pool.skipped_due_to_prior_apollo}).`,
    )
  }

  return {
    qa_marker: APOLLO_PRODUCTION_YIELD_BENCHMARK_COHORT_QA_MARKER,
    company_limit,
    selected,
    skipped_due_to_prior_apollo: pool.skipped_due_to_prior_apollo,
    skipped_due_to_missing_canonical: pool.skipped_due_to_missing_canonical,
    deduped_company_names,
    deduped_domains,
    cohort_selection_evidence: evidence,
  }
}
