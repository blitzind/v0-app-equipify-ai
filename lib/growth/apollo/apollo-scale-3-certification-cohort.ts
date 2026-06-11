/** Apollo Scale-3 certification cohort selection — deterministic + forced overrides. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { loadApolloReplacementBenchmarkCohort } from "@/lib/growth/benchmark/apollo-replacement-benchmark-storage"
import { APOLLO_REPLACEMENT_BENCHMARK_ID } from "@/lib/growth/benchmark/apollo-replacement-benchmark-types"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS,
  type ApolloScale2LiveCohortCompany,
} from "@/lib/growth/apollo/apollo-scale-2-live-acquisition-certification"

import {
  APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES,
  dedupeApolloScale3CompanyCandidateIds,
  dedupeApolloScale3CompanyNames,
  normalizeApolloScale3CompanyName,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort-selection"

export const APOLLO_SCALE_3_CERTIFICATION_COHORT_QA_MARKER =
  "apollo-scale-3-certification-cohort-v1" as const

export type ApolloScale3CohortPreset = "certification_winners"

export {
  APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES,
  dedupeApolloScale3CompanyCandidateIds,
  dedupeApolloScale3CompanyNames,
  normalizeApolloScale3CompanyName,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort-selection"

export type ApolloScale3CohortSelector =
  | "default_deterministic"
  | "forced_company_names"
  | "forced_company_candidate_ids"
  | "certification_winners_preset"

export type ApolloScale3CohortSelectionReason =
  | "forced_company_name"
  | "forced_company_candidate_id"
  | "certification_winners_preset"
  | "deterministic_default_no_prior_apollo"
  | "zero_yield_control_pad"
  | "duplicate_company_name_skipped"
  | "duplicate_company_candidate_id_skipped"
  | "unresolved_company_name"
  | "unresolved_company_candidate_id"
  | "missing_domain"
  | "excluded_company_candidate_id"

export type ApolloScale3CohortSelectionEvidenceRow = {
  company_candidate_id: string | null
  company_name: string
  domain: string | null
  selection_reason: ApolloScale3CohortSelectionReason
  included: boolean
  skip_reason: string | null
  duplicate_of: string | null
}

export type ApolloScale3CertificationCohortResolution = {
  qa_marker: typeof APOLLO_SCALE_3_CERTIFICATION_COHORT_QA_MARKER
  selector: ApolloScale3CohortSelector
  company_limit: number
  selected: ApolloScale2LiveCohortCompany[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_domain: number
  deduped_input_names: number
  deduped_input_candidate_ids: number
  unresolved_company_names: string[]
  unresolved_company_candidate_ids: string[]
  cohort_selection_evidence: ApolloScale3CohortSelectionEvidenceRow[]
}

type DiscoveryRow = {
  company_candidate_id: string
  company_name: string
  canonical_company_id: string
  domain: string
  industry: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function compareDiscoveryRows(a: DiscoveryRow, b: DiscoveryRow): number {
  const nameCompare = a.company_name.localeCompare(b.company_name, "en", { sensitivity: "base" })
  if (nameCompare !== 0) return nameCompare
  return a.company_candidate_id.localeCompare(b.company_candidate_id)
}

function toCohortCompany(row: DiscoveryRow, prior_apollo_candidates: number): ApolloScale2LiveCohortCompany {
  return {
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    canonical_company_id: row.canonical_company_id,
    domain: row.domain,
    industry: row.industry,
    prior_apollo_candidates,
  }
}

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

async function loadDiscoveryRowsByCandidateIds(
  admin: SupabaseClient,
  companyCandidateIds: string[],
): Promise<DiscoveryRow[]> {
  if (companyCandidateIds.length === 0) return []

  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, canonical_company_id, industry, domain, website")
    .in("company_id", companyCandidateIds)

  const rows: DiscoveryRow[] = []
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>
    const company_candidate_id = asString(row.company_id)
    const canonical_company_id = asString(row.canonical_company_id)
    if (!company_candidate_id || !canonical_company_id) continue
    const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
    if (!domain) continue
    rows.push({
      company_candidate_id,
      company_name: asString(row.company_name) || company_candidate_id,
      canonical_company_id,
      domain,
      industry: asString(row.industry) || null,
    })
  }
  return rows.sort(compareDiscoveryRows)
}

async function loadDiscoveryRowsForCompanyNames(
  admin: SupabaseClient,
  companyNames: string[],
): Promise<Map<string, DiscoveryRow>> {
  const matches = new Map<string, DiscoveryRow>()
  if (companyNames.length === 0) return matches

  const { data } = await admin
    .schema("growth")
    .from("discovery_candidates")
    .select("company_id, company_name, canonical_company_id, industry, domain, website")
    .not("canonical_company_id", "is", null)
    .limit(5000)

  const wanted = new Set(companyNames.map((name) => normalizeApolloScale3CompanyName(name)))
  const candidatesByKey = new Map<string, DiscoveryRow[]>()

  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>
    const company_name = asString(row.company_name)
    const key = normalizeApolloScale3CompanyName(company_name)
    if (!wanted.has(key)) continue

    const company_candidate_id = asString(row.company_id)
    const canonical_company_id = asString(row.canonical_company_id)
    if (!company_candidate_id || !canonical_company_id) continue
    const domain = canonicalNormalizedDomain(asString(row.domain), asString(row.website))
    if (!domain) continue

    const discoveryRow: DiscoveryRow = {
      company_candidate_id,
      company_name: company_name || company_candidate_id,
      canonical_company_id,
      domain,
      industry: asString(row.industry) || null,
    }
    const bucket = candidatesByKey.get(key) ?? []
    bucket.push(discoveryRow)
    candidatesByKey.set(key, bucket)
  }

  for (const [key, bucket] of candidatesByKey) {
    bucket.sort(compareDiscoveryRows)
    matches.set(key, bucket[0]!)
  }

  return matches
}

async function loadDeterministicDefaultPool(
  admin: SupabaseClient,
  input: { limit: number; env?: NodeJS.ProcessEnv },
): Promise<{
  rows: DiscoveryRow[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_domain: number
}> {
  const limit = Math.max(15, Math.min(20, input.limit))
  const exclude = new Set<string>([
    ...APOLLO_SCALE_2_EXCLUDED_COMPANY_CANDIDATE_IDS,
    ...(input.env?.GROWTH_APOLLO_SCALE_2_EXCLUDE_COMPANY_CANDIDATE_IDS?.split(",").map((s) => s.trim()) ??
      []),
  ])

  const cohort = await loadApolloReplacementBenchmarkCohort(admin, APOLLO_REPLACEMENT_BENCHMARK_ID)
  const canonicalIds = cohort?.company_ids?.slice(0, 200) ?? []

  const eligibleRows: DiscoveryRow[] = []
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
      .order("company_name", { ascending: true })
      .order("company_id", { ascending: true })
      .limit(Math.max(limit * 4, canonicalIds.length))
    ingestDiscoveryRows(cohortCandidates)
  }

  if (eligibleRows.length < limit) {
    const { data: fallbackCandidates } = await admin
      .schema("growth")
      .from("discovery_candidates")
      .select(discoverySelect)
      .not("canonical_company_id", "is", null)
      .order("company_name", { ascending: true })
      .order("company_id", { ascending: true })
      .limit(limit * 6)
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
    if (rows.length >= limit) break
  }

  return { rows, skipped_due_to_prior_apollo, skipped_due_to_missing_domain }
}

function buildResolution(input: {
  selector: ApolloScale3CohortSelector
  company_limit: number
  selected: ApolloScale2LiveCohortCompany[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_domain: number
  deduped_input_names: number
  deduped_input_candidate_ids: number
  unresolved_company_names: string[]
  unresolved_company_candidate_ids: string[]
  cohort_selection_evidence: ApolloScale3CohortSelectionEvidenceRow[]
}): ApolloScale3CertificationCohortResolution {
  return {
    qa_marker: APOLLO_SCALE_3_CERTIFICATION_COHORT_QA_MARKER,
    selector: input.selector,
    company_limit: input.company_limit,
    selected: input.selected,
    skipped_due_to_prior_apollo: input.skipped_due_to_prior_apollo,
    skipped_due_to_missing_domain: input.skipped_due_to_missing_domain,
    deduped_input_names: input.deduped_input_names,
    deduped_input_candidate_ids: input.deduped_input_candidate_ids,
    unresolved_company_names: input.unresolved_company_names,
    unresolved_company_candidate_ids: input.unresolved_company_candidate_ids,
    cohort_selection_evidence: input.cohort_selection_evidence,
  }
}

async function resolveForcedCompanyNames(
  admin: SupabaseClient,
  input: {
    company_names: string[]
    company_limit: number
    allow_prior_apollo: boolean
    selection_reason: ApolloScale3CohortSelectionReason
  },
): Promise<ApolloScale3CertificationCohortResolution> {
  const { unique, deduped_count } = dedupeApolloScale3CompanyNames(input.company_names)
  const matches = await loadDiscoveryRowsForCompanyNames(admin, unique)
  const priorApolloByCompany = await loadPriorApolloCounts(admin, [...matches.values()].map((row) => row.company_candidate_id))

  const selected: ApolloScale2LiveCohortCompany[] = []
  const evidence: ApolloScale3CohortSelectionEvidenceRow[] = []
  const seenCandidateIds = new Set<string>()
  const seenNormalizedNames = new Set<string>()
  const unresolved_company_names: string[] = []

  for (const requestedName of unique) {
    const normalized = normalizeApolloScale3CompanyName(requestedName)
    const row = matches.get(normalized) ?? null
    if (!row) {
      unresolved_company_names.push(requestedName)
      evidence.push({
        company_candidate_id: null,
        company_name: requestedName,
        domain: null,
        selection_reason: "unresolved_company_name",
        included: false,
        skip_reason: "discovery_candidate_not_found",
        duplicate_of: null,
      })
      continue
    }

    if (seenNormalizedNames.has(normalized)) {
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
    seenNormalizedNames.add(normalized)

    if (seenCandidateIds.has(row.company_candidate_id)) {
      evidence.push({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
        selection_reason: "duplicate_company_candidate_id_skipped",
        included: false,
        skip_reason: "duplicate_company_candidate_id",
        duplicate_of: row.company_candidate_id,
      })
      continue
    }

    const prior = priorApolloByCompany.get(row.company_candidate_id) ?? 0
    if (!input.allow_prior_apollo && prior > 0) {
      evidence.push({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
        selection_reason: input.selection_reason,
        included: false,
        skip_reason: "prior_apollo_candidates_present",
        duplicate_of: null,
      })
      continue
    }

    seenCandidateIds.add(row.company_candidate_id)
    selected.push(toCohortCompany(row, prior))
    evidence.push({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
      selection_reason: input.selection_reason,
      included: true,
      skip_reason: null,
      duplicate_of: null,
    })
    if (selected.length >= input.company_limit) break
  }

  return buildResolution({
    selector:
      input.selection_reason === "certification_winners_preset"
        ? "certification_winners_preset"
        : "forced_company_names",
    company_limit: input.company_limit,
    selected,
    skipped_due_to_prior_apollo: 0,
    skipped_due_to_missing_domain: 0,
    deduped_input_names: deduped_count,
    deduped_input_candidate_ids: 0,
    unresolved_company_names,
    unresolved_company_candidate_ids: [],
    cohort_selection_evidence: evidence,
  })
}

async function resolveForcedCompanyCandidateIds(
  admin: SupabaseClient,
  input: {
    company_candidate_ids: string[]
    company_limit: number
    allow_prior_apollo: boolean
  },
): Promise<ApolloScale3CertificationCohortResolution> {
  const { unique, deduped_count } = dedupeApolloScale3CompanyCandidateIds(input.company_candidate_ids)
  const rows = await loadDiscoveryRowsByCandidateIds(admin, unique)
  const rowById = new Map(rows.map((row) => [row.company_candidate_id, row] as const))
  const priorApolloByCompany = await loadPriorApolloCounts(admin, unique)

  const selected: ApolloScale2LiveCohortCompany[] = []
  const evidence: ApolloScale3CohortSelectionEvidenceRow[] = []
  const seenCandidateIds = new Set<string>()
  const unresolved_company_candidate_ids: string[] = []

  for (const requestedId of unique) {
    const row = rowById.get(requestedId) ?? null
    if (!row) {
      unresolved_company_candidate_ids.push(requestedId)
      evidence.push({
        company_candidate_id: requestedId,
        company_name: requestedId,
        domain: null,
        selection_reason: "unresolved_company_candidate_id",
        included: false,
        skip_reason: "discovery_candidate_not_found_or_missing_domain",
        duplicate_of: null,
      })
      continue
    }

    if (seenCandidateIds.has(row.company_candidate_id)) {
      evidence.push({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
        selection_reason: "duplicate_company_candidate_id_skipped",
        included: false,
        skip_reason: "duplicate_company_candidate_id",
        duplicate_of: row.company_candidate_id,
      })
      continue
    }

    const prior = priorApolloByCompany.get(row.company_candidate_id) ?? 0
    if (!input.allow_prior_apollo && prior > 0) {
      evidence.push({
        company_candidate_id: row.company_candidate_id,
        company_name: row.company_name,
        domain: row.domain,
        selection_reason: "forced_company_candidate_id",
        included: false,
        skip_reason: "prior_apollo_candidates_present",
        duplicate_of: null,
      })
      continue
    }

    seenCandidateIds.add(row.company_candidate_id)
    selected.push(toCohortCompany(row, prior))
    evidence.push({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
      selection_reason: "forced_company_candidate_id",
      included: true,
      skip_reason: null,
      duplicate_of: null,
    })
    if (selected.length >= input.company_limit) break
  }

  return buildResolution({
    selector: "forced_company_candidate_ids",
    company_limit: input.company_limit,
    selected,
    skipped_due_to_prior_apollo: 0,
    skipped_due_to_missing_domain: 0,
    deduped_input_names: 0,
    deduped_input_candidate_ids: deduped_count,
    unresolved_company_names: [],
    unresolved_company_candidate_ids,
    cohort_selection_evidence: evidence,
  })
}

async function padCohortWithZeroYieldControls(
  admin: SupabaseClient,
  input: {
    base: ApolloScale3CertificationCohortResolution
    company_limit: number
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale3CertificationCohortResolution> {
  if (input.base.selected.length >= input.company_limit) return input.base

  const selectedIds = new Set(input.base.selected.map((row) => row.company_candidate_id))
  const selectedNames = new Set(
    input.base.selected.map((row) => normalizeApolloScale3CompanyName(row.company_name)),
  )
  const pool = await loadDeterministicDefaultPool(admin, {
    limit: input.company_limit * 3,
    env: input.env,
  })

  const evidence = [...input.base.cohort_selection_evidence]
  const selected = [...input.base.selected]

  for (const row of pool.rows) {
    if (selected.length >= input.company_limit) break
    if (selectedIds.has(row.company_candidate_id)) continue
    const normalized = normalizeApolloScale3CompanyName(row.company_name)
    if (selectedNames.has(normalized)) {
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

    selectedIds.add(row.company_candidate_id)
    selectedNames.add(normalized)
    selected.push(toCohortCompany(row, 0))
    evidence.push({
      company_candidate_id: row.company_candidate_id,
      company_name: row.company_name,
      domain: row.domain,
      selection_reason: "zero_yield_control_pad",
      included: true,
      skip_reason: null,
      duplicate_of: null,
    })
  }

  return {
    ...input.base,
    selected,
    cohort_selection_evidence: evidence,
  }
}

export async function resolveApolloScale3CertificationCohort(
  admin: SupabaseClient,
  input: {
    company_limit: number
    company_names?: string[]
    company_candidate_ids?: string[]
    cohort_preset?: ApolloScale3CohortPreset
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloScale3CertificationCohortResolution> {
  const company_limit = Math.max(15, Math.min(20, input.company_limit))

  if (input.cohort_preset === "certification_winners") {
    const winners = await resolveForcedCompanyNames(admin, {
      company_names: [...APOLLO_SCALE_3_CERTIFICATION_WINNER_COMPANY_NAMES],
      company_limit,
      allow_prior_apollo: true,
      selection_reason: "certification_winners_preset",
    })
    return padCohortWithZeroYieldControls(admin, {
      base: winners,
      company_limit,
      env: input.env,
    })
  }

  if (input.company_candidate_ids && input.company_candidate_ids.length > 0) {
    const forced = await resolveForcedCompanyCandidateIds(admin, {
      company_candidate_ids: input.company_candidate_ids,
      company_limit,
      allow_prior_apollo: true,
    })
    return padCohortWithZeroYieldControls(admin, {
      base: forced,
      company_limit,
      env: input.env,
    })
  }

  if (input.company_names && input.company_names.length > 0) {
    const forced = await resolveForcedCompanyNames(admin, {
      company_names: input.company_names,
      company_limit,
      allow_prior_apollo: true,
      selection_reason: "forced_company_name",
    })
    return padCohortWithZeroYieldControls(admin, {
      base: forced,
      company_limit,
      env: input.env,
    })
  }

  const pool = await loadDeterministicDefaultPool(admin, { limit: company_limit, env: input.env })
  if (pool.rows.length < 15) {
    throw new Error(
      `Apollo-Scale-3 requires 15–20 companies with no prior Apollo acquisition; only ${pool.rows.length} eligible (skipped_prior_apollo=${pool.skipped_due_to_prior_apollo}, skipped_missing_domain=${pool.skipped_due_to_missing_domain}).`,
    )
  }

  const evidence: ApolloScale3CohortSelectionEvidenceRow[] = pool.rows.map((row) => ({
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    domain: row.domain,
    selection_reason: "deterministic_default_no_prior_apollo",
    included: true,
    skip_reason: null,
    duplicate_of: null,
  }))

  return buildResolution({
    selector: "default_deterministic",
    company_limit,
    selected: pool.rows.map((row) => toCohortCompany(row, 0)),
    skipped_due_to_prior_apollo: pool.skipped_due_to_prior_apollo,
    skipped_due_to_missing_domain: pool.skipped_due_to_missing_domain,
    deduped_input_names: 0,
    deduped_input_candidate_ids: 0,
    unresolved_company_names: [],
    unresolved_company_candidate_ids: [],
    cohort_selection_evidence: evidence,
  })
}

/** Scale-2-compatible cohort shape for shared acquisition runner. */
export function toApolloScale2LiveCohortShape(
  resolution: ApolloScale3CertificationCohortResolution,
): {
  selected: ApolloScale2LiveCohortCompany[]
  skipped_due_to_prior_apollo: number
  skipped_due_to_missing_domain: number
} {
  return {
    selected: resolution.selected,
    skipped_due_to_prior_apollo: resolution.skipped_due_to_prior_apollo,
    skipped_due_to_missing_domain: resolution.skipped_due_to_missing_domain,
  }
}
