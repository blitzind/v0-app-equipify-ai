import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  createEmptyCanonicalCompanyResolverIndexes,
  registerNewCanonicalCompanyFromCandidate,
  resolveCanonicalCompany,
} from "@/lib/growth/canonical-companies/canonical-company-resolver"
import type {
  GrowthCanonicalCompanyBackfillStats,
  GrowthCanonicalCompanyCandidateInput,
  GrowthCanonicalCompanySourceTable,
} from "@/lib/growth/canonical-companies/canonical-company-types"

function emptySourceStats() {
  return {
    rows_processed: 0,
    already_linked: 0,
    resolved_normalized_domain: 0,
    resolved_domain_alias: 0,
    resolved_name_city: 0,
    resolved_name_state: 0,
    would_create_new: 0,
    review_tier: 0,
    errors: 0,
  }
}

function bumpStats(
  stats: GrowthCanonicalCompanyBackfillStats["sources"][GrowthCanonicalCompanySourceTable],
  resolution: ReturnType<typeof resolveCanonicalCompany>,
): void {
  stats.rows_processed++
  if (resolution.would_create_new) stats.would_create_new++
  if (resolution.review_tier) stats.review_tier++
  switch (resolution.resolution_method) {
    case "normalized_domain":
      stats.resolved_normalized_domain++
      break
    case "domain_alias":
      stats.resolved_domain_alias++
      break
    case "name_city":
      stats.resolved_name_city++
      break
    case "name_state":
      stats.resolved_name_state++
      break
    default:
      break
  }
}

/** In-memory dry-run simulation without database (for unit tests). */
export function simulateCanonicalCompanyBackfill(
  candidates: GrowthCanonicalCompanyCandidateInput[],
): {
  stats: Pick<GrowthCanonicalCompanyBackfillStats, "sources" | "unique_normalized_domains" | "merge_groups_by_domain">
  company_ids_by_source: Map<string, string>
} {
  const indexes = createEmptyCanonicalCompanyResolverIndexes()
  const companyIdsBySource = new Map<string, string>()
  const stats = {
    external_company_candidates: emptySourceStats(),
    real_world_company_candidates: emptySourceStats(),
    discovery_candidates: emptySourceStats(),
  }
  const domainGroups = new Map<string, number>()

  for (const input of candidates) {
    const d = canonicalNormalizedDomain(input.domain, input.website)
    if (d) domainGroups.set(d, (domainGroups.get(d) ?? 0) + 1)
    const resolution = resolveCanonicalCompany(input, indexes)
    bumpStats(stats[input.source_table], resolution)
    let companyId = resolution.company_id
    if (!companyId) {
      companyId = `sim-${companyIdsBySource.size + 1}`
      registerNewCanonicalCompanyFromCandidate(indexes, companyId, input)
    }
    companyIdsBySource.set(`${input.source_table}:${input.source_id}`, companyId)
  }

  let mergeGroups = 0
  for (const c of domainGroups.values()) if (c > 1) mergeGroups++

  return {
    stats: {
      sources: stats,
      unique_normalized_domains: indexes.by_normalized_domain.size,
      merge_groups_by_domain: mergeGroups,
    },
    company_ids_by_source: companyIdsBySource,
  }
}
