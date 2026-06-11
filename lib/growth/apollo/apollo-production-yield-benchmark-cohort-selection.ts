/** Apollo production yield benchmark cohort selection — client-safe helpers. */

import {
  APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT,
  APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT,
} from "@/lib/growth/apollo/apollo-production-yield-benchmark-types"
import {
  dedupeApolloScale3CompanyNames,
  normalizeApolloScale3CompanyName,
} from "@/lib/growth/apollo/apollo-scale-3-certification-cohort-selection"

export function resolveApolloProductionYieldBenchmarkCompanyLimit(input?: {
  company_limit?: number
  env?: NodeJS.ProcessEnv
}): number {
  const env = input?.env ?? process.env
  const fromInput = input?.company_limit
  const fromEnv = Number.parseInt(
    env.GROWTH_APOLLO_PRODUCTION_YIELD_BENCHMARK_COMPANY_LIMIT ?? "50",
    10,
  )
  const raw = fromInput ?? fromEnv
  if (!Number.isFinite(raw) || raw <= 0) return APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT
  if (raw <= 50) return APOLLO_PRODUCTION_YIELD_BENCHMARK_DEFAULT_COMPANY_LIMIT
  return APOLLO_PRODUCTION_YIELD_BENCHMARK_MAX_COMPANY_LIMIT
}

/** Deterministic cohort preview for tests — no DB, uses synthetic ordering rules. */
export function previewDeterministicGreenfieldCohortSelection(input: {
  rows: Array<{
    company_candidate_id: string
    company_name: string
    domain: string | null
    prior_apollo_candidates: number
  }>
  company_limit: number
}): {
  selected_ids: string[]
  deduped_company_names: number
  deduped_domains: number
} {
  const sorted = [...input.rows]
    .filter((row) => row.prior_apollo_candidates === 0)
    .sort((a, b) => {
      const nameCompare = a.company_name.localeCompare(b.company_name, "en", { sensitivity: "base" })
      if (nameCompare !== 0) return nameCompare
      return a.company_candidate_id.localeCompare(b.company_candidate_id)
    })

  const selected_ids: string[] = []
  const seenNames = new Set<string>()
  const seenDomains = new Set<string>()
  let deduped_company_names = 0
  let deduped_domains = 0

  for (const row of sorted) {
    const normalizedName = normalizeApolloScale3CompanyName(row.company_name)
    if (seenNames.has(normalizedName)) {
      deduped_company_names += 1
      continue
    }
    if (row.domain) {
      const domainKey = row.domain.toLowerCase()
      if (seenDomains.has(domainKey)) {
        deduped_domains += 1
        continue
      }
      seenDomains.add(domainKey)
    }
    seenNames.add(normalizedName)
    selected_ids.push(row.company_candidate_id)
    if (selected_ids.length >= input.company_limit) break
  }

  return { selected_ids, deduped_company_names, deduped_domains }
}

export function dedupeApolloProductionYieldCompanyNames(names: string[]): {
  unique: string[]
  deduped_count: number
} {
  return dedupeApolloScale3CompanyNames(names)
}
