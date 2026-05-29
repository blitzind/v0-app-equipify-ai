import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyAcquisitionRunState,
  emptyAcquisitionStats,
  emptyAcquisitionThroughputMetrics,
  GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH,
  GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT,
  GROWTH_BULK_ACQUISITION_QA_MARKER,
  type GrowthBulkAcquisitionKeysetCursor,
  type GrowthBulkAcquisitionPhase,
  type GrowthBulkAcquisitionRun,
  type GrowthBulkAcquisitionRunState,
  type GrowthBulkAcquisitionRunStatus,
} from "@/lib/growth/acquisition/acquisition-types"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"
import { isGrowthRealWorldDiscoverySchemaReady } from "@/lib/growth/real-world-discovery/real-world-discovery-schema-health"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseKeysetCursor(value: unknown): GrowthBulkAcquisitionKeysetCursor | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const created_at = asString(row.created_at)
  const id = asString(row.id)
  if (!created_at || !id) return null
  return { created_at, id }
}

function parseAcquisitionState(metadata: Record<string, unknown>): GrowthBulkAcquisitionRunState | null {
  const acquisition = metadata.acquisition
  if (!acquisition || typeof acquisition !== "object") return null
  const state = acquisition as Record<string, unknown>
  if (asString(state.qa_marker) !== GROWTH_BULK_ACQUISITION_QA_MARKER) return null

  const statsRaw = state.stats && typeof state.stats === "object" ? (state.stats as Record<string, unknown>) : {}
  const metricsRaw =
    state.metrics && typeof state.metrics === "object" ? (state.metrics as Record<string, unknown>) : {}
  const queryPlanRaw =
    state.query_plan && typeof state.query_plan === "object" ? (state.query_plan as Record<string, unknown>) : {}
  const searchInputsRaw =
    state.search_inputs && typeof state.search_inputs === "object"
      ? (state.search_inputs as GrowthRealWorldDiscoverySearchInputs)
      : {}

  const base = emptyAcquisitionRunState({
    search_inputs: searchInputsRaw,
    query_plan: {
      primary: Array.isArray(queryPlanRaw.primary) ? queryPlanRaw.primary.map(String) : [],
      fallback: Array.isArray(queryPlanRaw.fallback) ? queryPlanRaw.fallback.map(String) : [],
    },
    limit_per_query: Number(state.limit_per_query ?? GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT),
    geo_tiles: Array.isArray(state.geo_tiles) ? state.geo_tiles.map(String) : [],
    target_company_count:
      state.target_company_count == null ? null : Number(state.target_company_count),
  })

  return {
    ...base,
    phase: (asString(state.phase) || "discover_companies") as GrowthBulkAcquisitionPhase,
    query_index: Number(state.query_index ?? 0),
    use_fallback_queries: Boolean(state.use_fallback_queries),
    child_run_ids: Array.isArray(state.child_run_ids) ? state.child_run_ids.map(String) : [],
    stats: {
      ...emptyAcquisitionStats(),
      companies_discovered: Number(statsRaw.companies_discovered ?? 0),
      companies_contacts_processed: Number(statsRaw.companies_contacts_processed ?? 0),
      contact_candidates_stored: Number(statsRaw.contact_candidates_stored ?? 0),
      company_contacts_synced: Number(statsRaw.company_contacts_synced ?? 0),
      contacts_verified: Number(statsRaw.contacts_verified ?? 0),
      leads_created: Number(statsRaw.leads_created ?? 0),
      leads_linked_duplicate: Number(statsRaw.leads_linked_duplicate ?? 0),
      leads_suppressed: Number(statsRaw.leads_suppressed ?? 0),
      leads_skipped: Number(statsRaw.leads_skipped ?? 0),
      leads_error: Number(statsRaw.leads_error ?? 0),
    },
    metrics: {
      ...emptyAcquisitionThroughputMetrics(),
      ticks_completed: Number(metricsRaw.ticks_completed ?? 0),
      last_tick_duration_ms: Number(metricsRaw.last_tick_duration_ms ?? 0),
      total_tick_duration_ms: Number(metricsRaw.total_tick_duration_ms ?? 0),
      provider_errors: Number(metricsRaw.provider_errors ?? 0),
      verification_failures: Number(metricsRaw.verification_failures ?? 0),
      emails_verification_attempted: Number(metricsRaw.emails_verification_attempted ?? 0),
      contacts_discovered: Number(metricsRaw.contacts_discovered ?? statsRaw.contact_candidates_stored ?? 0),
      emails_verified: Number(metricsRaw.emails_verified ?? statsRaw.contacts_verified ?? 0),
    },
    geo_tile_index: Number(state.geo_tile_index ?? 0),
    executed_query_keys: Array.isArray(state.executed_query_keys)
      ? state.executed_query_keys.map(String)
      : [],
    consecutive_zero_discovery: Number(state.consecutive_zero_discovery ?? 0),
    discovery_exhausted: Boolean(state.discovery_exhausted),
    contact_discovery_cursor: parseKeysetCursor(state.contact_discovery_cursor),
    contact_discovery_exhausted: Boolean(state.contact_discovery_exhausted),
    verify_company_scan_cursor: parseKeysetCursor(state.verify_company_scan_cursor),
    promote_company_scan_cursor: parseKeysetCursor(state.promote_company_scan_cursor),
    last_tick_at: asString(state.last_tick_at) || null,
    last_error: asString(state.last_error) || null,
  }
}

function rowToAcquisitionRun(row: Record<string, unknown>): GrowthBulkAcquisitionRun | null {
  const metadata =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
  const state = parseAcquisitionState(metadata)
  if (!state) return null

  return {
    id: asString(row.id),
    query: asString(row.query),
    industry: asString(row.industry) || null,
    location: asString(row.location) || null,
    status: (asString(row.status) || "running") as GrowthBulkAcquisitionRunStatus,
    created_by: asString(row.created_by) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    state,
  }
}

function companyContactsProcessed(metadata: Record<string, unknown>): boolean {
  const acquisition =
    metadata.acquisition && typeof metadata.acquisition === "object"
      ? (metadata.acquisition as Record<string, unknown>)
      : {}
  return Boolean(asString(acquisition.contacts_processed_at))
}

function applyKeysetCursor<T extends { order: (col: string, opts: { ascending: boolean }) => T }>(
  query: T,
  cursor: GrowthBulkAcquisitionKeysetCursor | null | undefined,
): T {
  if (!cursor) return query
  return query.or(
    `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
  ) as T
}

export async function isGrowthBulkAcquisitionSchemaReady(admin: SupabaseClient): Promise<boolean> {
  return isGrowthRealWorldDiscoverySchemaReady(admin)
}

export async function createBulkAcquisitionRun(
  admin: SupabaseClient,
  input: {
    search_inputs: GrowthRealWorldDiscoverySearchInputs
    query_plan: { primary: string[]; fallback: string[] }
    primary_query: string
    created_by?: string | null
    limit_per_query?: number
    geo_tiles?: string[]
    target_company_count?: number | null
  },
): Promise<GrowthBulkAcquisitionRun | null> {
  if (!(await isGrowthBulkAcquisitionSchemaReady(admin))) return null

  const state = emptyAcquisitionRunState({
    search_inputs: input.search_inputs,
    query_plan: input.query_plan,
    limit_per_query: input.limit_per_query ?? GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT,
    geo_tiles: input.geo_tiles ?? [],
    target_company_count: input.target_company_count ?? null,
  })

  const industry = input.search_inputs.industry?.trim() || null
  const location = input.search_inputs.location?.trim() || null

  const { data, error } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .insert({
      created_by: input.created_by ?? null,
      query: input.primary_query,
      industry,
      location,
      provider_names: ["bulk_acquisition"],
      status: "running",
      candidate_count: 0,
      metadata: {
        qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
        acquisition: state,
      },
    })
    .select("*")
    .single()

  if (error || !data) return null
  return rowToAcquisitionRun(data as Record<string, unknown>)
}

export async function loadBulkAcquisitionRun(
  admin: SupabaseClient,
  runId: string,
): Promise<GrowthBulkAcquisitionRun | null> {
  const { data } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle()
  if (!data) return null
  return rowToAcquisitionRun(data as Record<string, unknown>)
}

export async function listBulkAcquisitionRuns(
  admin: SupabaseClient,
  limit = 20,
): Promise<GrowthBulkAcquisitionRun[]> {
  const { data } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("*")
    .contains("metadata", { qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER })
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? [])
    .map((row) => rowToAcquisitionRun(row as Record<string, unknown>))
    .filter((run): run is GrowthBulkAcquisitionRun => run !== null)
}

export async function listRunnableBulkAcquisitionRuns(
  admin: SupabaseClient,
  limit = 5,
): Promise<GrowthBulkAcquisitionRun[]> {
  const { data } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("*")
    .contains("metadata", { qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER })
    .in("status", ["running", "partial"])
    .order("updated_at", { ascending: true })
    .limit(Math.max(limit * 3, limit))

  return (data ?? [])
    .map((row) => rowToAcquisitionRun(row as Record<string, unknown>))
    .filter((run): run is GrowthBulkAcquisitionRun => run !== null)
    .filter((run) => run.state.phase !== "done" && run.status !== "completed")
    .slice(0, limit)
}

export async function saveBulkAcquisitionRunState(
  admin: SupabaseClient,
  runId: string,
  input: {
    state: GrowthBulkAcquisitionRunState
    status?: GrowthBulkAcquisitionRunStatus
    candidate_count?: number
  },
): Promise<GrowthBulkAcquisitionRun | null> {
  const { data: existing } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .select("metadata")
    .eq("id", runId)
    .maybeSingle()

  const metadata =
    existing?.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {}

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    metadata: {
      ...metadata,
      qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
      acquisition: input.state,
    },
  }
  if (input.status) patch.status = input.status
  if (input.candidate_count !== undefined) patch.candidate_count = input.candidate_count

  const { data, error } = await admin
    .schema("growth")
    .from("real_world_discovery_runs")
    .update(patch)
    .eq("id", runId)
    .select("*")
    .single()

  if (error || !data) return null
  return rowToAcquisitionRun(data as Record<string, unknown>)
}

export async function loadAcquisitionDedupeHashes(
  admin: SupabaseClient,
  childRunIds: string[],
): Promise<Set<string>> {
  const hashes = new Set<string>()
  if (childRunIds.length === 0) return hashes

  let cursor: GrowthBulkAcquisitionKeysetCursor | null = null
  const pageSize = 500

  while (true) {
    let query = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id, created_at, dedupe_hash")
      .in("run_id", childRunIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(pageSize)

    query = applyKeysetCursor(query, cursor)

    const { data } = await query
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const hash = asString((row as Record<string, unknown>).dedupe_hash)
      if (hash) hashes.add(hash)
    }

    const last = rows[rows.length - 1] as Record<string, unknown>
    cursor = {
      created_at: asString(last.created_at),
      id: asString(last.id),
    }
    if (rows.length < pageSize) break
  }

  return hashes
}

export async function scanAcquisitionCompanyCandidateBatch(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    cursor?: GrowthBulkAcquisitionKeysetCursor | null
    batch_size?: number
  },
): Promise<{
  company_ids: string[]
  cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  if (input.child_run_ids.length === 0) {
    return { company_ids: [], cursor: input.cursor ?? null, exhausted: true }
  }

  const batchSize = input.batch_size ?? GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH
  let query = admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id, created_at")
    .in("run_id", input.child_run_ids)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(batchSize)

  query = applyKeysetCursor(query, input.cursor)

  const { data } = await query
  const rows = data ?? []
  if (rows.length === 0) {
    return { company_ids: [], cursor: input.cursor ?? null, exhausted: true }
  }

  const last = rows[rows.length - 1] as Record<string, unknown>
  const nextCursor = {
    created_at: asString(last.created_at),
    id: asString(last.id),
  }

  return {
    company_ids: rows.map((row) => asString((row as Record<string, unknown>).id)).filter(Boolean),
    cursor: nextCursor,
    exhausted: rows.length < batchSize,
  }
}

export async function listCompaniesPendingContactDiscovery(
  admin: SupabaseClient,
  input: {
    acquisition_run_id: string
    child_run_ids: string[]
    limit?: number
    cursor?: GrowthBulkAcquisitionKeysetCursor | null
  },
): Promise<{
  companies: Array<{ id: string; company_name: string; website: string | null }>
  cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  if (input.child_run_ids.length === 0) {
    return { companies: [], cursor: input.cursor ?? null, exhausted: true }
  }

  const target = input.limit ?? 3
  const pending: Array<{ id: string; company_name: string; website: string | null }> = []
  let cursor = input.cursor ?? null
  let exhausted = false
  const scanBatch = GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH

  while (pending.length < target) {
    let query = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id, company_name, website, metadata, created_at")
      .in("run_id", input.child_run_ids)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(scanBatch)

    query = applyKeysetCursor(query, cursor)

    const { data } = await query
    const rows = data ?? []
    if (rows.length === 0) {
      exhausted = true
      break
    }

    for (const row of rows) {
      const r = row as Record<string, unknown>
      const metadata =
        r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
      if (companyContactsProcessed(metadata)) continue

      pending.push({
        id: asString(r.id),
        company_name: asString(r.company_name),
        website: asString(r.website) || null,
      })
      if (pending.length >= target) break
    }

    const last = rows[rows.length - 1] as Record<string, unknown>
    cursor = {
      created_at: asString(last.created_at),
      id: asString(last.id),
    }

    if (rows.length < scanBatch) {
      exhausted = true
      break
    }
  }

  return { companies: pending, cursor, exhausted }
}

export async function markCompanyContactsProcessed(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    acquisition_run_id: string
  },
): Promise<void> {
  const { data } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("metadata")
    .eq("id", input.company_candidate_id)
    .maybeSingle()

  const metadata =
    data?.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {}

  await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .update({
      metadata: {
        ...metadata,
        acquisition: {
          ...(metadata.acquisition && typeof metadata.acquisition === "object"
            ? (metadata.acquisition as Record<string, unknown>)
            : {}),
          run_id: input.acquisition_run_id,
          contacts_processed_at: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.company_candidate_id)
}
