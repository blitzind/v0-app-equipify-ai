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
} from "@/lib/growth/canonical-companies/canonical-company-repository-core"
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
  GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE,
  GROWTH_CANONICAL_COMPANY_BACKFILL_MAX_BATCH_SIZE,
  type GrowthCanonicalCompanyBackfillCursor,
  type GrowthCanonicalCompanyBackfillResult,
  type GrowthCanonicalCompanyBackfillStats,
  type GrowthCanonicalCompanyCandidateInput,
  type GrowthCanonicalCompanySourceTable,
} from "@/lib/growth/canonical-companies/canonical-company-types"

const DEFAULT_SOURCES: GrowthCanonicalCompanySourceTable[] = [
  "external_company_candidates",
  "real_world_company_candidates",
  "discovery_candidates",
]

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

function emptyStats(mode: "dry_run" | "apply", existingCount: number): GrowthCanonicalCompanyBackfillStats {
  return {
    qa_marker: GROWTH_CANONICAL_COMPANY_QA_MARKER,
    mode,
    sources: {
      external_company_candidates: emptySourceStats(),
      real_world_company_candidates: emptySourceStats(),
      discovery_candidates: emptySourceStats(),
    },
    canonical_companies_existing: existingCount,
    canonical_companies_after: existingCount,
    unique_normalized_domains: 0,
    merge_groups_by_domain: 0,
  }
}

function selectForTable(table: GrowthCanonicalCompanySourceTable): string {
  return table === "discovery_candidates"
    ? "id, run_id, company_id, source_type, discovery_source_type, company_name, website, domain, industry, location, city, state, source_confidence, dedupe_hash, discovered_at, created_at, metadata, canonical_company_id"
    : "id, run_id, provider_name, provider_type, company_name, website, domain, phone, address, city, state, country, industry, confidence, dedupe_hash, created_at, metadata, canonical_company_id, query"
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

function mergeGroupsFromDomainCounts(domainCounts: Record<string, number>): number {
  let mergeGroups = 0
  for (const count of Object.values(domainCounts)) {
    if (count > 1) mergeGroups++
  }
  return mergeGroups
}

function trackDomain(domainCounts: Record<string, number>, domain: string | null): void {
  if (!domain) return
  domainCounts[domain] = (domainCounts[domain] ?? 0) + 1
}

export async function countUnlinkedStagingCandidates(
  admin: SupabaseClient,
  table: GrowthCanonicalCompanySourceTable,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from(table)
    .select("id", { count: "exact", head: true })
    .is("canonical_company_id", null)
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count ?? 0
}

async function fetchPendingChunk(
  admin: SupabaseClient,
  table: GrowthCanonicalCompanySourceTable,
  afterId: string | null,
  limit: number,
): Promise<Record<string, unknown>[]> {
  let query = admin
    .schema("growth")
    .from(table)
    .select(selectForTable(table))
    .is("canonical_company_id", null)
    .order("id", { ascending: true })
    .limit(limit)

  if (afterId) {
    query = query.gt("id", afterId)
  }

  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return (data ?? []) as Record<string, unknown>[]
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

function resolveBatchSize(batchSize?: number): number | null {
  if (batchSize == null) return null
  return Math.min(
    GROWTH_CANONICAL_COMPANY_BACKFILL_MAX_BATCH_SIZE,
    Math.max(1, Math.floor(batchSize)),
  )
}

function resolveStartTable(
  sources: GrowthCanonicalCompanySourceTable[],
  cursor: GrowthCanonicalCompanyBackfillCursor | null | undefined,
): GrowthCanonicalCompanySourceTable {
  if (cursor?.source_table && sources.includes(cursor.source_table)) {
    return cursor.source_table
  }
  return sources[0]
}

function nextSourceTable(
  sources: GrowthCanonicalCompanySourceTable[],
  current: GrowthCanonicalCompanySourceTable,
): GrowthCanonicalCompanySourceTable | null {
  const idx = sources.indexOf(current)
  if (idx < 0 || idx >= sources.length - 1) return null
  return sources[idx + 1]
}

export async function runCanonicalCompanyBackfill(
  admin: SupabaseClient,
  options: {
    mode: "dry_run" | "apply"
    sources?: GrowthCanonicalCompanySourceTable[]
    batchSize?: number
    cursor?: GrowthCanonicalCompanyBackfillCursor | null
  },
): Promise<GrowthCanonicalCompanyBackfillResult> {
  const mode = options.mode
  const sources = options.sources ?? DEFAULT_SOURCES
  const batchSize = resolveBatchSize(
    options.batchSize ?? (options.cursor != null ? GROWTH_CANONICAL_COMPANY_BACKFILL_DEFAULT_BATCH_SIZE : undefined),
  )

  const existingCount = await countCanonicalCompanies(admin)
  const loaded = await loadCanonicalCompanyIndexesFromDb(admin)
  const indexes = buildIndexesFromDb(loaded)

  const stats = emptyStats(mode, existingCount)
  stats.unique_normalized_domains = indexes.by_normalized_domain.size

  const pending_by_source: Record<GrowthCanonicalCompanySourceTable, number> = {
    external_company_candidates: await countUnlinkedStagingCandidates(admin, "external_company_candidates"),
    real_world_company_candidates: await countUnlinkedStagingCandidates(admin, "real_world_company_candidates"),
    discovery_candidates: await countUnlinkedStagingCandidates(admin, "discovery_candidates"),
  }

  const domainCounts: Record<string, number> = { ...(options.cursor?.domain_counts ?? {}) }

  if (batchSize == null) {
    return runCanonicalCompanyBackfillFull(admin, {
      mode,
      sources,
      stats,
      indexes,
      domainCounts,
      existingCount,
      pending_by_source,
    })
  }

  let table = resolveStartTable(sources, options.cursor)
  let afterId = options.cursor?.after_id ?? null
  let processedInChunk = 0

  while (processedInChunk < batchSize) {
    const remaining = batchSize - processedInChunk
    const rows = await fetchPendingChunk(admin, table, afterId, remaining)

    for (const row of rows) {
      const input = mapRow(table, row)
      const d = canonicalNormalizedDomain(input.domain, input.website)
      trackDomain(domainCounts, d)
      await processCandidate(admin, input, indexes, mode, stats.sources[table])
      processedInChunk++
      afterId = asString(row.id)
      if (processedInChunk >= batchSize) break
    }

    if (rows.length < remaining) {
      const nextTable = nextSourceTable(sources, table)
      if (!nextTable) {
        stats.merge_groups_by_domain = mergeGroupsFromDomainCounts(domainCounts)
        stats.unique_normalized_domains = indexes.by_normalized_domain.size
        stats.canonical_companies_after =
          mode === "apply" ? await countCanonicalCompanies(admin) : stats.canonical_companies_existing + totalWouldCreate(stats)

        return {
          stats,
          done: true,
          cursor: null,
          progress: {
            batch_size: batchSize,
            processed_in_chunk: processedInChunk,
            current_source_table: table,
          },
          pending_by_source,
        }
      }
      table = nextTable
      afterId = null
    }
  }

  stats.merge_groups_by_domain = mergeGroupsFromDomainCounts(domainCounts)
  stats.unique_normalized_domains = indexes.by_normalized_domain.size
  stats.canonical_companies_after =
    stats.canonical_companies_existing + totalWouldCreate(stats)

  return {
    stats,
    done: false,
    cursor: {
      source_table: table,
      after_id: afterId,
      domain_counts: domainCounts,
    },
    progress: {
      batch_size: batchSize,
      processed_in_chunk: processedInChunk,
      current_source_table: table,
    },
    pending_by_source,
  }
}

function totalWouldCreate(stats: GrowthCanonicalCompanyBackfillStats): number {
  return (
    stats.sources.external_company_candidates.would_create_new +
    stats.sources.real_world_company_candidates.would_create_new +
    stats.sources.discovery_candidates.would_create_new
  )
}

async function runCanonicalCompanyBackfillFull(
  admin: SupabaseClient,
  input: {
    mode: "dry_run" | "apply"
    sources: GrowthCanonicalCompanySourceTable[]
    stats: GrowthCanonicalCompanyBackfillStats
    indexes: CanonicalCompanyResolverIndexes
    domainCounts: Record<string, number>
    existingCount: number
    pending_by_source: Record<GrowthCanonicalCompanySourceTable, number>
  },
): Promise<GrowthCanonicalCompanyBackfillResult> {
  const { mode, sources, stats, indexes, domainCounts, existingCount, pending_by_source } = input
  let lastTable = sources[0]

  for (const table of sources) {
    lastTable = table
    let afterId: string | null = null
    while (true) {
      const rows = await fetchPendingChunk(admin, table, afterId, 1000)
      if (rows.length === 0) break
      for (const row of rows) {
        const inputRow = mapRow(table, row)
        const d = canonicalNormalizedDomain(inputRow.domain, inputRow.website)
        trackDomain(domainCounts, d)
        await processCandidate(admin, inputRow, indexes, mode, stats.sources[table])
        afterId = asString(row.id)
      }
      if (rows.length < 1000) break
    }
  }

  stats.merge_groups_by_domain = mergeGroupsFromDomainCounts(domainCounts)
  stats.unique_normalized_domains = indexes.by_normalized_domain.size
  stats.canonical_companies_after =
    mode === "apply" ? await countCanonicalCompanies(admin) : existingCount + totalWouldCreate(stats)

  return {
    stats,
    done: true,
    cursor: null,
    progress: {
      batch_size: 0,
      processed_in_chunk: Object.values(stats.sources).reduce((n, s) => n + s.rows_processed, 0),
      current_source_table: lastTable,
    },
    pending_by_source,
  }
}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}
