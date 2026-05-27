import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import {
  evaluateTerritoryMatch,
  normalizeTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-geo"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { buildTerritoryName, inferTerritoryType } from "@/lib/growth/territory-intelligence/territory-builder"
import {
  GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
  type GrowthTerritoryCompanyRow,
  type GrowthTerritoryMapCompany,
  type GrowthTerritoryMapSnapshot,
  type GrowthTerritoryRow,
  type GrowthTerritoryScoreRow,
} from "@/lib/growth/territory-intelligence/territory-intelligence-types"
import { isGrowthTerritoryIntelligenceSchemaReady } from "@/lib/growth/territory-intelligence/territory-intelligence-schema-health"
import {
  buildTerritoryHeatmapPoints,
  companyTerritoryScoreBucket,
  computeTerritoryScoreMetrics,
  type TerritoryScoringCompanyInput,
} from "@/lib/growth/territory-intelligence/territory-scoring"
import { companyToTerritoryScoringInput } from "@/lib/growth/territory-intelligence/integrations/prospect-search-territory-overlay"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToTerritory(row: Record<string, unknown>): GrowthTerritoryRow {
  return {
    id: asString(row.id),
    name: asString(row.name),
    territory_type: asString(row.territory_type) as GrowthTerritoryRow["territory_type"],
    territory_filter: normalizeTerritoryFilter(
      row.territory_filter && typeof row.territory_filter === "object"
        ? (row.territory_filter as GrowthProspectSearchTerritoryFilter)
        : {},
    ),
    industry: asString(row.industry) || null,
    icp_label: asString(row.icp_label) || null,
    saved_search_id: asString(row.saved_search_id) || null,
    query_text: asString(row.query_text),
    filters: normalizeProspectSearchFilters(
      row.filters && typeof row.filters === "object"
        ? (row.filters as Partial<GrowthProspectSearchFilters>)
        : {},
    ),
    created_by: asString(row.created_by) || null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

function rowToScore(row: Record<string, unknown>): GrowthTerritoryScoreRow {
  return {
    territory_id: asString(row.territory_id),
    company_count: Number(row.company_count ?? 0),
    mapped_company_count: Number(row.mapped_company_count ?? 0),
    unmapped_company_count: Number(row.unmapped_company_count ?? 0),
    high_fit_count: Number(row.high_fit_count ?? 0),
    contact_coverage_avg: Number(row.contact_coverage_avg ?? 0),
    growth_signal_avg: Number(row.growth_signal_avg ?? 0),
    growth_signal_density: Number(row.growth_signal_density ?? 0),
    existing_customer_count: Number(row.existing_customer_count ?? 0),
    existing_prospect_count: Number(row.existing_prospect_count ?? 0),
    suppressed_count: Number(row.suppressed_count ?? 0),
    whitespace_score: Number(row.whitespace_score ?? 0),
    territory_opportunity_score: Number(row.territory_opportunity_score ?? 0),
    score_buckets:
      row.score_buckets && typeof row.score_buckets === "object"
        ? (row.score_buckets as GrowthTerritoryScoreRow["score_buckets"])
        : { urgent: 0, high: 0, moderate: 0, low: 0, unmapped: 0 },
    clusters: Array.isArray(row.clusters) ? (row.clusters as GrowthTerritoryScoreRow["clusters"]) : [],
    whitespace_zones: Array.isArray(row.whitespace_zones)
      ? (row.whitespace_zones as GrowthTerritoryScoreRow["whitespace_zones"])
      : [],
    top_signal_companies: Array.isArray(row.top_signal_companies)
      ? (row.top_signal_companies as GrowthTerritoryScoreRow["top_signal_companies"])
      : [],
    last_computed_at: asString(row.last_computed_at),
  }
}

export async function listTerritories(admin: SupabaseClient, limit = 50): Promise<GrowthTerritoryRow[]> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return []
  const { data } = await admin
    .schema("growth")
    .from("territories")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map((row) => rowToTerritory(row as Record<string, unknown>))
}

export async function loadTerritoryById(
  admin: SupabaseClient,
  territoryId: string,
): Promise<GrowthTerritoryRow | null> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return null
  const { data } = await admin.schema("growth").from("territories").select("*").eq("id", territoryId).maybeSingle()
  return data ? rowToTerritory(data as Record<string, unknown>) : null
}

export async function resolveTerritoryFilters(
  admin: SupabaseClient,
  filters: GrowthProspectSearchFilters,
): Promise<GrowthProspectSearchFilters> {
  if (!filters.territory_id) return filters
  const territory = await loadTerritoryById(admin, filters.territory_id)
  if (!territory) return filters

  return normalizeProspectSearchFilters({
    ...territory.filters,
    ...filters,
    territory_id: territory.id,
    territory_filter: territory.territory_filter,
    industry: filters.industry ?? territory.industry ?? territory.filters.industry,
  })
}

export async function createTerritory(
  admin: SupabaseClient,
  input: {
    name?: string | null
    territory_filter: GrowthProspectSearchTerritoryFilter
    industry?: string | null
    icp_label?: string | null
    saved_search_id?: string | null
    query_text?: string
    filters?: Partial<GrowthProspectSearchFilters>
    created_by?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthTerritoryRow | null> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return null

  const territory_filter = normalizeTerritoryFilter(input.territory_filter)
  const filters = normalizeProspectSearchFilters({
    ...(input.filters ?? {}),
    territory_filter,
    industry: input.industry ?? input.filters?.industry ?? null,
  })

  const { data, error } = await admin
    .schema("growth")
    .from("territories")
    .insert({
      name: buildTerritoryName({
        name: input.name,
        territory_filter,
        industry: input.industry,
      }),
      territory_type: inferTerritoryType(territory_filter),
      territory_filter,
      industry: input.industry ?? null,
      icp_label: input.icp_label ?? null,
      saved_search_id: input.saved_search_id ?? null,
      query_text: input.query_text?.trim().slice(0, 300) ?? "",
      filters,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? {},
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error || !data) return null
  return rowToTerritory(data as Record<string, unknown>)
}

export async function createTerritoryFromSavedSearch(
  admin: SupabaseClient,
  input: {
    saved_search_id: string
    name?: string | null
    created_by?: string | null
  },
): Promise<GrowthTerritoryRow | null> {
  const { data } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("*")
    .eq("id", input.saved_search_id)
    .maybeSingle()

  if (!data) return null
  const row = data as Record<string, unknown>
  const filters = normalizeProspectSearchFilters(
    row.filters && typeof row.filters === "object"
      ? (row.filters as Partial<GrowthProspectSearchFilters>)
      : {},
  )

  return createTerritory(admin, {
    name: input.name ?? asString(row.name),
    territory_filter: filters.territory_filter ?? {},
    industry: filters.industry,
    icp_label: asString(row.name) || null,
    saved_search_id: input.saved_search_id,
    query_text: asString(row.query_text),
    filters,
    created_by: input.created_by,
    metadata: { source: "saved_search" },
  })
}

function matchCompaniesToTerritory(
  companies: GrowthProspectSearchCompanyResult[],
  territoryFilter: GrowthProspectSearchTerritoryFilter,
): Array<{ company: GrowthProspectSearchCompanyResult; reasons: string[] }> {
  return companies
    .map((company) => {
      const match = evaluateTerritoryMatch(
        {
          city: company.city,
          state: company.state,
          postal_code: company.postal_code,
          country: company.country,
          location: company.location,
          service_area: company.service_area,
          metro: company.metro,
          lat: company.lat,
          lng: company.lng,
        },
        territoryFilter,
      )
      return { company, reasons: match.reasons, matches: match.matches }
    })
    .filter((entry) => entry.matches)
    .map(({ company, reasons }) => ({ company, reasons }))
}

async function persistTerritoryCompanies(
  admin: SupabaseClient,
  territoryId: string,
  companies: TerritoryScoringCompanyInput[],
  matchReasonsById: Map<string, string[]>,
) {
  await admin.schema("growth").from("territory_companies").delete().eq("territory_id", territoryId)

  for (const company of companies) {
    const hasCoords =
      typeof company.lat === "number" &&
      Number.isFinite(company.lat) &&
      typeof company.lng === "number" &&
      Number.isFinite(company.lng)

    await admin.schema("growth").from("territory_companies").insert({
      territory_id: territoryId,
      company_id: company.company_id,
      source_type: company.source_type,
      company_name: company.company_name,
      lat: hasCoords ? company.lat : null,
      lng: hasCoords ? company.lng : null,
      is_mapped: hasCoords,
      match_reasons: matchReasonsById.get(`${company.source_type}:${company.company_id}`) ?? [],
      lead_engine_score: company.lead_engine_score,
      growth_signal_score: company.growth_signal_score,
      contact_coverage_score: company.contact_coverage_score,
      score_bucket: companyTerritoryScoreBucket(company),
      is_existing_customer: company.is_existing_customer ?? false,
      is_existing_prospect: company.is_existing_prospect ?? false,
      is_suppressed: company.is_suppressed ?? false,
      last_matched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}

async function persistTerritoryScore(
  admin: SupabaseClient,
  territoryId: string,
  metrics: Omit<GrowthTerritoryScoreRow, "territory_id" | "last_computed_at">,
): Promise<GrowthTerritoryScoreRow> {
  const payload = {
    territory_id: territoryId,
    ...metrics,
    last_computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await admin.schema("growth").from("territory_scores").upsert(payload)
  return { ...payload, territory_id: territoryId }
}

export async function computeTerritoryFromCompanies(
  admin: SupabaseClient,
  territoryId: string,
  companies: GrowthProspectSearchCompanyResult[],
): Promise<GrowthTerritoryScoreRow | null> {
  const territory = await loadTerritoryById(admin, territoryId)
  if (!territory) return null

  const matched = matchCompaniesToTerritory(companies, territory.territory_filter)
  const scoringInputs = matched.map(({ company }) => companyToTerritoryScoringInput(company))
  const reasonsMap = new Map<string, string[]>()
  for (const entry of matched) {
    reasonsMap.set(`${entry.company.source_type}:${entry.company.id}`, entry.reasons)
  }

  await persistTerritoryCompanies(admin, territoryId, scoringInputs, reasonsMap)
  const metrics = computeTerritoryScoreMetrics(scoringInputs)
  return persistTerritoryScore(admin, territoryId, metrics)
}

export async function refreshTerritoryIntelligence(
  admin: SupabaseClient,
  territoryId: string,
): Promise<GrowthTerritoryMapSnapshot | null> {
  const territory = await loadTerritoryById(admin, territoryId)
  if (!territory) return null

  const { runProspectSearch } = await import("@/lib/growth/prospect-search/prospect-search-repository")
  const search = await runProspectSearch(admin, {
    query: territory.query_text,
    filters: territory.filters,
    page: 1,
    page_size: 200,
    discovery_mode: "internal",
  })

  await computeTerritoryFromCompanies(admin, territoryId, search.companies)
  return loadTerritoryMapSnapshot(admin, territoryId)
}

export async function loadTerritoryScore(
  admin: SupabaseClient,
  territoryId: string,
): Promise<GrowthTerritoryScoreRow | null> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return null
  const { data } = await admin
    .schema("growth")
    .from("territory_scores")
    .select("*")
    .eq("territory_id", territoryId)
    .maybeSingle()
  return data ? rowToScore(data as Record<string, unknown>) : null
}

export async function loadTerritoryCompanies(
  admin: SupabaseClient,
  territoryId: string,
  limit = 200,
): Promise<GrowthTerritoryCompanyRow[]> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) return []
  const { data } = await admin
    .schema("growth")
    .from("territory_companies")
    .select("*")
    .eq("territory_id", territoryId)
    .order("growth_signal_score", { ascending: false, nullsFirst: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      territory_id: asString(r.territory_id),
      company_id: asString(r.company_id),
      source_type: asString(r.source_type),
      company_name: asString(r.company_name),
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
      is_mapped: r.is_mapped === true,
      match_reasons: Array.isArray(r.match_reasons) ? (r.match_reasons as string[]) : [],
      lead_engine_score: typeof r.lead_engine_score === "number" ? r.lead_engine_score : null,
      growth_signal_score: typeof r.growth_signal_score === "number" ? r.growth_signal_score : null,
      contact_coverage_score: typeof r.contact_coverage_score === "number" ? r.contact_coverage_score : null,
      score_bucket: asString(r.score_bucket) as GrowthTerritoryCompanyRow["score_bucket"],
      is_existing_customer: r.is_existing_customer === true,
      is_existing_prospect: r.is_existing_prospect === true,
      is_suppressed: r.is_suppressed === true,
      last_matched_at: asString(r.last_matched_at),
    }
  })
}

export async function loadTerritoryMapSnapshot(
  admin: SupabaseClient,
  territoryId: string,
): Promise<GrowthTerritoryMapSnapshot> {
  if (!(await isGrowthTerritoryIntelligenceSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
      schema_ready: false,
      territory: null,
      score: null,
      companies: [],
      heatmap_points: [],
      clusters: [],
      whitespace_zones: [],
      privacy_note: GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE,
    }
  }

  const [territory, score, companyRows] = await Promise.all([
    loadTerritoryById(admin, territoryId),
    loadTerritoryScore(admin, territoryId),
    loadTerritoryCompanies(admin, territoryId),
  ])

  const companies: GrowthTerritoryMapCompany[] = companyRows.map((row) => ({
    company_id: row.company_id,
    source_type: row.source_type,
    company_name: row.company_name,
    lat: row.lat,
    lng: row.lng,
    is_mapped: row.is_mapped,
    score_bucket: row.score_bucket,
    lead_engine_score: row.lead_engine_score,
    growth_signal_score: row.growth_signal_score,
    contact_coverage_score: row.contact_coverage_score,
  }))

  const scoringInputs: TerritoryScoringCompanyInput[] = companyRows.map((row) => ({
    company_id: row.company_id,
    source_type: row.source_type,
    company_name: row.company_name,
    lat: row.lat,
    lng: row.lng,
    lead_engine_score: row.lead_engine_score,
    growth_signal_score: row.growth_signal_score,
    contact_coverage_score: row.contact_coverage_score,
    is_existing_customer: row.is_existing_customer,
    is_existing_prospect: row.is_existing_prospect,
    is_suppressed: row.is_suppressed,
  }))

  return {
    qa_marker: GROWTH_TERRITORY_INTELLIGENCE_QA_MARKER,
    schema_ready: true,
    territory,
    score,
    companies,
    heatmap_points: buildTerritoryHeatmapPoints(scoringInputs),
    clusters: score?.clusters ?? [],
    whitespace_zones: score?.whitespace_zones ?? [],
    privacy_note: GROWTH_TERRITORY_INTELLIGENCE_PRIVACY_NOTE,
  }
}

export async function queueStaleTerritoryRefresh(admin: SupabaseClient, limit = 50): Promise<number> {
  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("territory_scores")
    .select("territory_id")
    .lt("last_computed_at", staleBefore)
    .limit(limit)

  let queued = 0
  for (const row of data ?? []) {
    const territoryId = asString((row as Record<string, unknown>).territory_id)
    if (!territoryId) continue
    const { error } = await admin.schema("growth").from("territory_refresh_queue").upsert(
      { territory_id: territoryId, reason: "stale", status: "pending", scheduled_for: new Date().toISOString() },
      { onConflict: "territory_id,reason" },
    )
    if (!error) queued += 1
  }
  return queued
}

export async function processTerritoryRefreshQueue(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ processed: number; failed: number }> {
  const { data } = await admin
    .schema("growth")
    .from("territory_refresh_queue")
    .select("id, territory_id")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    const territoryId = asString((row as Record<string, unknown>).territory_id)
    if (!queueId || !territoryId) continue

    await admin.schema("growth").from("territory_refresh_queue").update({ status: "running" }).eq("id", queueId)

    try {
      await refreshTerritoryIntelligence(admin, territoryId)
      await admin
        .schema("growth")
        .from("territory_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("territory_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message : "Refresh failed",
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return { processed, failed }
}

export async function computeTerritoryFromSearchResults(
  admin: SupabaseClient,
  territoryId: string,
  companies: GrowthProspectSearchCompanyResult[],
): Promise<GrowthTerritoryScoreRow | null> {
  return computeTerritoryFromCompanies(admin, territoryId, companies)
}
