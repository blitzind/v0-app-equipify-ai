import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyAcquisitionRunState,
  emptyAcquisitionStats,
  emptyAcquisitionThroughputMetrics,
  GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH,
  GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT,
  GROWTH_BULK_ACQUISITION_QA_MARKER,
  type GrowthBulkAcquisitionArtifactView,
  type GrowthBulkAcquisitionCompanyArtifact,
  type GrowthBulkAcquisitionContactArtifact,
  type GrowthBulkAcquisitionKeysetCursor,
  type GrowthBulkAcquisitionLeadArtifact,
  type GrowthBulkAcquisitionPhase,
  type GrowthBulkAcquisitionRun,
  type GrowthBulkAcquisitionRunState,
  type GrowthBulkAcquisitionRunStatus,
  type GrowthBulkAcquisitionTickLogEntry,
} from "@/lib/growth/acquisition/acquisition-types"
import { parseContactDiscoveryProviderOutcomes } from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
import type { GrowthContactDiscoveryProviderOutcome } from "@/lib/growth/contact-discovery/contact-discovery-provider-outcomes"
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

function parseTickLogEntry(value: unknown): GrowthBulkAcquisitionTickLogEntry | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const at = asString(row.at)
  const phase = asString(row.phase) as GrowthBulkAcquisitionPhase
  if (!at || !phase) return null
  return {
    at,
    phase,
    actions: Array.isArray(row.actions) ? row.actions.map(String) : [],
    duration_ms: Number(row.duration_ms ?? 0),
    done: Boolean(row.done),
    error_message: asString(row.error_message) || null,
    error_stack: asString(row.error_stack) || null,
    error_action: asString(row.error_action) || null,
  }
}

function parseLastErrorDiagnostics(
  value: unknown,
): GrowthBulkAcquisitionRunState["last_error_diagnostics"] {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const runId = asString(row.runId)
  const phase = asString(row.phase) as GrowthBulkAcquisitionPhase
  const message = asString(row.message)
  const at = asString(row.at)
  if (!runId || !phase || !message || !at) return null
  return {
    at,
    message,
    stack: asString(row.stack) || null,
    runId,
    phase,
    action: asString(row.action) || null,
    companyId: asString(row.companyId) || null,
    contactId: asString(row.contactId) || null,
  }
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
    paused: Boolean(state.paused),
    paused_at: asString(state.paused_at) || null,
    last_tick: parseTickLogEntry(state.last_tick),
    recent_ticks: Array.isArray(state.recent_ticks)
      ? state.recent_ticks
          .map((entry) => parseTickLogEntry(entry))
          .filter((entry): entry is GrowthBulkAcquisitionTickLogEntry => entry !== null)
      : [],
    last_tick_at: asString(state.last_tick_at) || null,
    last_error: asString(state.last_error) || null,
    last_error_stack: asString(state.last_error_stack) || null,
    last_error_diagnostics: parseLastErrorDiagnostics(state.last_error_diagnostics),
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

function acquisitionMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return metadata.acquisition && typeof metadata.acquisition === "object"
    ? (metadata.acquisition as Record<string, unknown>)
    : {}
}

function companyContactsProcessed(metadata: Record<string, unknown>): boolean {
  return Boolean(asString(acquisitionMetadata(metadata).contacts_processed_at))
}

function companyContactDiscoveryFields(metadata: Record<string, unknown>): {
  contacts_processed_at: string | null
  provider_outcomes: GrowthContactDiscoveryProviderOutcome[]
  contact_discovery_persistence_error: string | null
} {
  const acquisition = acquisitionMetadata(metadata)
  return {
    contacts_processed_at: asString(acquisition.contacts_processed_at) || null,
    provider_outcomes: parseContactDiscoveryProviderOutcomes(acquisition.provider_outcomes),
    contact_discovery_persistence_error:
      asString(acquisition.contact_discovery_persistence_error) || null,
  }
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
    .filter((run) => run.state.phase !== "done" && run.status !== "completed" && !run.state.paused)
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
    provider_outcomes?: GrowthContactDiscoveryProviderOutcome[]
    persistence_error?: string | null
    discovery_run_id?: string | null
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
  const priorAcquisition = acquisitionMetadata(metadata)

  await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .update({
      metadata: {
        ...metadata,
        acquisition: {
          ...priorAcquisition,
          run_id: input.acquisition_run_id,
          contacts_processed_at: new Date().toISOString(),
          provider_outcomes: input.provider_outcomes ?? [],
          contact_discovery_persistence_error: input.persistence_error ?? null,
          contact_discovery_run_id: input.discovery_run_id ?? null,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.company_candidate_id)
}

export async function setBulkAcquisitionRunPaused(
  admin: SupabaseClient,
  runId: string,
  paused: boolean,
): Promise<GrowthBulkAcquisitionRun | null> {
  const run = await loadBulkAcquisitionRun(admin, runId)
  if (!run) return null
  if (run.state.phase === "done" || run.status === "completed") return run

  const state: GrowthBulkAcquisitionRunState = {
    ...run.state,
    paused,
    paused_at: paused ? new Date().toISOString() : null,
  }

  return saveBulkAcquisitionRunState(admin, runId, {
    state,
    status: paused ? run.status : run.status === "partial" ? "running" : run.status,
  })
}

export async function listAcquisitionRunArtifacts(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    view: GrowthBulkAcquisitionArtifactView
    cursor?: GrowthBulkAcquisitionKeysetCursor | null
    limit?: number
  },
): Promise<{
  view: GrowthBulkAcquisitionArtifactView
  items: GrowthBulkAcquisitionCompanyArtifact[] | GrowthBulkAcquisitionContactArtifact[] | GrowthBulkAcquisitionLeadArtifact[]
  cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  if (input.child_run_ids.length === 0) {
    return { view: input.view, items: [], cursor: input.cursor ?? null, exhausted: true }
  }

  if (input.view === "companies") {
    let query = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id, company_name, website, domain, city, state, location, query, metadata, created_at")
      .in("run_id", input.child_run_ids)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit)

    if (input.cursor) {
      query = query.or(
        `created_at.lt.${input.cursor.created_at},and(created_at.eq.${input.cursor.created_at},id.lt.${input.cursor.id})`,
      )
    }

    const { data } = await query
    const rows = data ?? []
    const items: GrowthBulkAcquisitionCompanyArtifact[] = rows.map((row) => {
      const r = row as Record<string, unknown>
      const metadata =
        r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
      const discovery = companyContactDiscoveryFields(metadata)
      return {
        id: asString(r.id),
        company_name: asString(r.company_name),
        website: asString(r.website) || null,
        domain: asString(r.domain) || null,
        city: asString(r.city) || null,
        state: asString(r.state) || null,
        location: asString(r.location) || null,
        query: asString(r.query) || null,
        contacts_processed: companyContactsProcessed(metadata),
        contacts_processed_at: discovery.contacts_processed_at,
        provider_outcomes: discovery.provider_outcomes,
        contact_discovery_persistence_error: discovery.contact_discovery_persistence_error,
        created_at: asString(r.created_at),
      }
    })

    const last = rows[rows.length - 1] as Record<string, unknown> | undefined
    return {
      view: input.view,
      items,
      cursor: last
        ? { created_at: asString(last.created_at), id: asString(last.id) }
        : input.cursor ?? null,
      exhausted: rows.length < limit,
    }
  }

  const contactRows = await loadAcquisitionContactArtifactPage(admin, {
    child_run_ids: input.child_run_ids,
    cursor: input.cursor,
    limit,
    verified_only: input.view === "verified",
    leads_only: input.view === "leads",
  })

  if (input.view === "leads") {
    return {
      view: input.view,
      items: contactRows.items.filter(
        (item): item is GrowthBulkAcquisitionLeadArtifact => "lead_id" in item,
      ),
      cursor: contactRows.cursor,
      exhausted: contactRows.exhausted,
    }
  }

  return {
    view: input.view,
    items: contactRows.items.filter(
      (item): item is GrowthBulkAcquisitionContactArtifact => "email_status" in item,
    ),
    cursor: contactRows.cursor,
    exhausted: contactRows.exhausted,
  }
}

async function loadAcquisitionContactArtifactPage(
  admin: SupabaseClient,
  input: {
    child_run_ids: string[]
    cursor?: GrowthBulkAcquisitionKeysetCursor | null
    limit: number
    verified_only: boolean
    leads_only: boolean
  },
): Promise<{
  items: Array<GrowthBulkAcquisitionContactArtifact | GrowthBulkAcquisitionLeadArtifact>
  cursor: GrowthBulkAcquisitionKeysetCursor | null
  exhausted: boolean
}> {
  const items: Array<GrowthBulkAcquisitionContactArtifact | GrowthBulkAcquisitionLeadArtifact> = []
  let cursor = input.cursor ?? null
  let exhausted = false
  const companyNameById = new Map<string, string>()

  while (items.length < input.limit) {
    let companyQuery = admin
      .schema("growth")
      .from("real_world_company_candidates")
      .select("id, company_name, created_at")
      .in("run_id", input.child_run_ids)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH)

    if (cursor) {
      companyQuery = companyQuery.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
      )
    }

    const { data: companyRows } = await companyQuery
    const companies = companyRows ?? []
    if (companies.length === 0) {
      exhausted = true
      break
    }

    for (const company of companies) {
      const row = company as Record<string, unknown>
      companyNameById.set(asString(row.id), asString(row.company_name))
    }

    const companyIds = companies
      .map((row) => asString((row as Record<string, unknown>).id))
      .filter(Boolean)

    let contactQuery = admin
      .schema("growth")
      .from("company_contacts")
      .select(
        "id, company_id, full_name, title, email, email_status, growth_lead_id, metadata, created_at",
      )
      .in("company_id", companyIds)
      .neq("contact_status", "archived")
      .neq("contact_status", "suppressed")
      .order("created_at", { ascending: false })
      .limit(input.limit - items.length)

    if (input.leads_only) {
      contactQuery = contactQuery.not("growth_lead_id", "is", null)
    } else if (input.verified_only) {
      contactQuery = contactQuery.eq("email_status", "verified")
    }

    const { data: contactData } = await contactQuery
    for (const contactRow of contactData ?? []) {
      const contact = contactRow as Record<string, unknown>
      const metadata =
        contact.metadata && typeof contact.metadata === "object"
          ? (contact.metadata as Record<string, unknown>)
          : {}
      const emailVerification =
        metadata.email_verification && typeof metadata.email_verification === "object"
          ? (metadata.email_verification as Record<string, unknown>)
          : {}
      const verifiedByProvider = emailVerification.verified_by_provider === true
      if (input.verified_only && !verifiedByProvider) continue

      const companyId = asString(contact.company_id)
      const companyName = companyNameById.get(companyId) ?? "Unknown company"
      const growthLeadId = asString(contact.growth_lead_id) || null

      if (input.leads_only && growthLeadId) {
        items.push({
          contact_id: asString(contact.id),
          lead_id: growthLeadId,
          company_name: companyName,
          full_name: asString(contact.full_name),
          email: asString(contact.email) || null,
          title: asString(contact.title) || null,
          created_at: asString(contact.created_at),
        })
      } else if (!input.leads_only) {
        items.push({
          id: asString(contact.id),
          company_id: companyId,
          company_name: companyName,
          full_name: asString(contact.full_name),
          title: asString(contact.title) || null,
          email: asString(contact.email) || null,
          email_status: asString(contact.email_status),
          verified_by_provider: verifiedByProvider,
          growth_lead_id: growthLeadId,
          created_at: asString(contact.created_at),
        })
      }

      if (items.length >= input.limit) break
    }

    const lastCompany = companies[companies.length - 1] as Record<string, unknown>
    cursor = {
      created_at: asString(lastCompany.created_at),
      id: asString(lastCompany.id),
    }

    if (companies.length < GROWTH_BULK_ACQUISITION_COMPANY_SCAN_BATCH) {
      exhausted = true
      break
    }
    if (items.length >= input.limit) break
  }

  return { items, cursor, exhausted }
}
