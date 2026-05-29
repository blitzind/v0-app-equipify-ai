import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  emptyAcquisitionStats,
  GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT,
  GROWTH_BULK_ACQUISITION_QA_MARKER,
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

function parseAcquisitionState(metadata: Record<string, unknown>): GrowthBulkAcquisitionRunState | null {
  const acquisition = metadata.acquisition
  if (!acquisition || typeof acquisition !== "object") return null
  const state = acquisition as Record<string, unknown>
  if (asString(state.qa_marker) !== GROWTH_BULK_ACQUISITION_QA_MARKER) return null

  const statsRaw = state.stats && typeof state.stats === "object" ? (state.stats as Record<string, unknown>) : {}
  const queryPlanRaw =
    state.query_plan && typeof state.query_plan === "object" ? (state.query_plan as Record<string, unknown>) : {}
  const searchInputsRaw =
    state.search_inputs && typeof state.search_inputs === "object"
      ? (state.search_inputs as GrowthRealWorldDiscoverySearchInputs)
      : {}

  return {
    qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
    phase: (asString(state.phase) || "discover_companies") as GrowthBulkAcquisitionPhase,
    search_inputs: searchInputsRaw,
    query_plan: {
      primary: Array.isArray(queryPlanRaw.primary) ? queryPlanRaw.primary.map(String) : [],
      fallback: Array.isArray(queryPlanRaw.fallback) ? queryPlanRaw.fallback.map(String) : [],
    },
    query_index: Number(state.query_index ?? 0),
    use_fallback_queries: Boolean(state.use_fallback_queries),
    child_run_ids: Array.isArray(state.child_run_ids) ? state.child_run_ids.map(String) : [],
    limit_per_query: Number(state.limit_per_query ?? GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT),
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
  },
): Promise<GrowthBulkAcquisitionRun | null> {
  if (!(await isGrowthBulkAcquisitionSchemaReady(admin))) return null

  const state: GrowthBulkAcquisitionRunState = {
    qa_marker: GROWTH_BULK_ACQUISITION_QA_MARKER,
    phase: "discover_companies",
    search_inputs: input.search_inputs,
    query_plan: input.query_plan,
    query_index: 0,
    use_fallback_queries: false,
    child_run_ids: [],
    limit_per_query: input.limit_per_query ?? GROWTH_BULK_ACQUISITION_DEFAULT_QUERY_LIMIT,
    stats: emptyAcquisitionStats(),
    last_tick_at: null,
    last_error: null,
  }

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

export async function listAcquisitionCompanyCandidateIds(
  admin: SupabaseClient,
  childRunIds: string[],
): Promise<string[]> {
  if (childRunIds.length === 0) return []

  const { data } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id")
    .in("run_id", childRunIds)
    .order("created_at", { ascending: true })
    .limit(5000)

  return (data ?? []).map((row) => asString((row as Record<string, unknown>).id)).filter(Boolean)
}

export async function listCompaniesPendingContactDiscovery(
  admin: SupabaseClient,
  input: {
    acquisition_run_id: string
    child_run_ids: string[]
    limit?: number
  },
): Promise<Array<{ id: string; company_name: string; website: string | null }>> {
  if (input.child_run_ids.length === 0) return []

  const { data } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select("id, company_name, website, metadata")
    .in("run_id", input.child_run_ids)
    .order("created_at", { ascending: true })
    .limit(500)

  const pending: Array<{ id: string; company_name: string; website: string | null }> = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const metadata =
      r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
    const acquisition =
      metadata.acquisition && typeof metadata.acquisition === "object"
        ? (metadata.acquisition as Record<string, unknown>)
        : {}
    if (asString(acquisition.contacts_processed_at)) continue
    pending.push({
      id: asString(r.id),
      company_name: asString(r.company_name),
      website: asString(r.website) || null,
    })
    if (pending.length >= (input.limit ?? 3)) break
  }
  return pending
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
