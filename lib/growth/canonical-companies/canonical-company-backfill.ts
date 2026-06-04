import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapDiscoveryCandidateRow,
  mapExternalCompanyCandidateRow,
  mapRealWorldCompanyCandidateRow,
} from "@/lib/growth/canonical-companies/canonical-company-candidate-mappers"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import {
  buildCanonicalCompanyInsertPayload,
  countCanonicalCompanies,
  domainRowsForCandidate,
  fetchLineageCompanyId,
  insertCanonicalCompany,
  loadCanonicalCompanyIndexesFromDb,
  updateStagingCanonicalCompanyId,
  upsertCanonicalCompanyDomain,
  upsertCanonicalCompanyLineage,
} from "@/lib/growth/canonical-companies/canonical-company-repository"
import {
  createEmptyCanonicalCompanyResolverIndexes,
  registerCanonicalCompanyInIndexes,
  registerNewCanonicalCompanyFromCandidate,
  resolveCanonicalCompany,
  type CanonicalCompanyResolverIndexes,
} from "@/lib/growth/canonical-companies/canonical-company-resolver"
export { simulateCanonicalCompanyBackfill } from "@/lib/growth/canonical-companies/canonical-company-simulate"
import {
  GROWTH_CANONICAL_COMPANY_QA_MARKER,
  type GrowthCanonicalCompanyBackfillStats,
  type GrowthCanonicalCompanyCandidateInput,
  type GrowthCanonicalCompanySourceTable,
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

async function fetchAllRows(
  admin: SupabaseClient,
  table: GrowthCanonicalCompanySourceTable,
  select: string,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await admin
      .schema("growth")
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return rows
}

function mapRow(
  table: GrowthCanonicalCompanySourceTable,
  row: Record<string, unknown>,
): GrowthCanonicalCompanyCandidateInput {
  if (table === "external_company_candidates") return mapExternalCompanyCandidateRow(row)
  if (table === "real_world_company_candidates") return mapRealWorldCompanyCandidateRow(row)
  return mapDiscoveryCandidateRow(row)
}

function buildIndexesFromDb(
  loaded: Awaited<ReturnType<typeof loadCanonicalCompanyIndexesFromDb>>,
): CanonicalCompanyResolverIndexes {
  const indexes = createEmptyCanonicalCompanyResolverIndexes()
  for (const c of loaded.companies) {
    registerCanonicalCompanyInIndexes(indexes, c.id, {
      primary_domain: c.primary_domain,
      normalized_domain: c.primary_domain,
      city: c.city,
      state: c.state,
      normalized_name: c.normalized_name,
    })
  }
  for (const d of loaded.domains) {
    indexes.by_normalized_domain.set(d.normalized_domain, d.company_id)
    indexes.by_exact_domain.set(d.domain.toLowerCase(), d.company_id)
    indexes.by_exact_domain.set(d.normalized_domain, d.company_id)
  }
  return indexes
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

async function processCandidate(
  admin: SupabaseClient,
  input: GrowthCanonicalCompanyCandidateInput,
  indexes: CanonicalCompanyResolverIndexes,
  mode: "dry_run" | "apply",
  stats: GrowthCanonicalCompanyBackfillStats["sources"][GrowthCanonicalCompanySourceTable],
): Promise<void> {
  try {
    const existingLineage = await fetchLineageCompanyId(admin, input.source_table, input.source_id)
    if (existingLineage) {
      stats.already_linked++
      stats.rows_processed++
      if (mode === "apply") {
        await updateStagingCanonicalCompanyId(admin, input.source_table, input.source_id, existingLineage)
      }
      return
    }

    const resolution = resolveCanonicalCompany(input, indexes)
    bumpStats(stats, resolution)

    if (mode === "dry_run") {
      if (resolution.would_create_new) {
        const dryId = resolution.normalized_domain
          ? `dry-${resolution.normalized_domain}`
          : `dry-${input.source_table}-${input.source_id}`
        registerNewCanonicalCompanyFromCandidate(indexes, dryId, input)
      }
      return
    }

    let companyId = resolution.company_id
    if (!companyId) {
      const payload = buildCanonicalCompanyInsertPayload(input, "new")
      companyId = await insertCanonicalCompany(admin, payload)
      registerNewCanonicalCompanyFromCandidate(indexes, companyId, input)
    } else {
      registerNewCanonicalCompanyFromCandidate(indexes, companyId, input)
    }

    for (const dr of domainRowsForCandidate(input, companyId)) {
      await upsertCanonicalCompanyDomain(admin, dr)
    }

    const observed = input.observed_at ?? new Date().toISOString()
    await upsertCanonicalCompanyLineage(admin, {
      company_id: companyId,
      source_table: input.source_table,
      source_id: input.source_id,
      provider_name: input.provider_name,
      provider_type: input.provider_type,
      run_id: input.run_id,
      confidence: input.confidence ?? 0,
      observed_at: observed,
      source_metadata: input.source_metadata ?? {},
    })
    await updateStagingCanonicalCompanyId(admin, input.source_table, input.source_id, companyId)
  } catch {
    stats.errors++
  }
}

export async function runCanonicalCompanyBackfill(
  admin: SupabaseClient,
  options: { mode: "dry_run" | "apply"; sources?: GrowthCanonicalCompanySourceTable[] },
): Promise<GrowthCanonicalCompanyBackfillStats> {
  const mode = options.mode
  const sources: GrowthCanonicalCompanySourceTable[] =
    options.sources ?? [
      "external_company_candidates",
      "real_world_company_candidates",
      "discovery_candidates",
    ]

  const existingCount = await countCanonicalCompanies(admin)
  const loaded = await loadCanonicalCompanyIndexesFromDb(admin)
  const indexes = buildIndexesFromDb(loaded)

  const stats: GrowthCanonicalCompanyBackfillStats = {
    qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
    mode,
    sources: {
      external_company_candidates: emptySourceStats(),
      real_world_company_candidates: emptySourceStats(),
      discovery_candidates: emptySourceStats(),
    },
    canonical_companies_existing: existingCount,
    canonical_companies_after: existingCount,
    unique_normalized_domains: indexes.by_normalized_domain.size,
    merge_groups_by_domain: 0,
  }

  const domainGroups = new Map<string, number>()

  for (const table of sources) {
    const select =
      table === "discovery_candidates"
        ? "id, run_id, company_id, source_type, discovery_source_type, company_name, website, domain, industry, location, city, state, source_confidence, dedupe_hash, discovered_at, created_at, metadata, canonical_company_id"
        : "id, run_id, provider_name, provider_type, company_name, website, domain, phone, address, city, state, country, industry, confidence, dedupe_hash, created_at, metadata, canonical_company_id, query"

    const rows = await fetchAllRows(admin, table, select)
    for (const row of rows) {
      if (asString(row.canonical_company_id)) {
        stats.sources[table].already_linked++
        stats.sources[table].rows_processed++
        continue
      }
      const input = mapRow(table, row)
      const d = canonicalNormalizedDomain(input.domain, input.website)
      if (d) domainGroups.set(d, (domainGroups.get(d) ?? 0) + 1)
      await processCandidate(admin, input, indexes, mode, stats.sources[table])
    }
  }

  let mergeGroups = 0
  for (const count of domainGroups.values()) {
    if (count > 1) mergeGroups++
  }
  stats.merge_groups_by_domain = mergeGroups
  stats.unique_normalized_domains = indexes.by_normalized_domain.size
  stats.canonical_companies_after =
    mode === "apply" ? await countCanonicalCompanies(admin) : existingCount + stats.sources.external_company_candidates.would_create_new + stats.sources.real_world_company_candidates.would_create_new + stats.sources.discovery_candidates.would_create_new

  return stats
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}
