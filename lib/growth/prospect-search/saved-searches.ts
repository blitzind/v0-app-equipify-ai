import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { countProspectSearchMatchesInternal } from "@/lib/growth/prospect-search/prospect-search-count"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import { isGrowthProspectSearchSchemaReady, GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE } from "@/lib/growth/prospect-search/prospect-search-schema-health"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  attachSavedSearchWorkflow,
  buildSavedSearchWorkflowMetadata,
  parseSavedSearchWorkflowMetadata,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import type {
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
  GrowthProspectSearchSavedSearchRow,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function savedSearchesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("prospect_search_saved_searches")
}

function mapSavedSearchRow(row: Record<string, unknown>): GrowthProspectSearchSavedSearchRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    created_by: asString(row.created_by) || null,
    name: asString(row.name),
    query_text: asString(row.query_text),
    filters: normalizeProspectSearchFilters(
      row.filters && typeof row.filters === "object"
        ? (row.filters as Partial<GrowthProspectSearchFilters>)
        : {},
    ),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export async function listProspectSearchSavedSearches(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchSavedSearchRow[]> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return []
  const { data, error } = await savedSearchesTable(admin)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50)
  if (error) return []
  return (data ?? []).map((row) => mapSavedSearchRow(row as Record<string, unknown>))
}

export async function listProspectSearchSavedSearchesWithWorkflow(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchSavedSearchWithWorkflow[]> {
  const rows = await listProspectSearchSavedSearches(admin)
  return rows.map((row) => attachSavedSearchWorkflow(row))
}

export async function getProspectSearchSavedSearch(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthProspectSearchSavedSearchRow | null> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return null
  const { data, error } = await savedSearchesTable(admin).select("*").eq("id", id).maybeSingle()
  if (error || !data) return null
  return mapSavedSearchRow(data as Record<string, unknown>)
}

export async function createProspectSearchSavedSearch(
  admin: SupabaseClient,
  input: {
    created_by?: string | null
    name: string
    query_text: string
    filters: GrowthProspectSearchFilters
    metadata?: Record<string, unknown>
  },
): Promise<GrowthProspectSearchSavedSearchRow | null> {
  const schemaReady = await isGrowthProspectSearchSchemaReady(admin)
  if (!schemaReady) {
    logGrowthEngine("prospect_search_saved_search_schema_not_ready", {
      action: "create",
      message: GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE,
    })
    return null
  }
  const now = new Date().toISOString()
  const { data, error } = await savedSearchesTable(admin)
    .insert({
      created_by: input.created_by ?? null,
      name: input.name.trim().slice(0, 120),
      query_text: input.query_text.trim().slice(0, 300),
      filters: normalizeProspectSearchFilters(input.filters),
      metadata: input.metadata ?? {},
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) {
    logGrowthEngine("prospect_search_saved_search_insert_failed", {
      action: "create",
      code: error?.code ?? null,
      message: error?.message ?? "insert_failed",
    })
    return null
  }
  return mapSavedSearchRow(data as Record<string, unknown>)
}

export async function updateProspectSearchSavedSearch(
  admin: SupabaseClient,
  id: string,
  input: {
    metadata?: Record<string, unknown>
    name?: string
  },
): Promise<GrowthProspectSearchSavedSearchRow | null> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return null
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.metadata) patch.metadata = input.metadata
  if (input.name) patch.name = input.name.trim().slice(0, 120)

  const { data, error } = await savedSearchesTable(admin).update(patch).eq("id", id).select("*").single()
  if (error || !data) return null
  return mapSavedSearchRow(data as Record<string, unknown>)
}

export async function refreshProspectSearchSavedSearchCount(
  admin: SupabaseClient,
  savedSearchId: string,
): Promise<GrowthProspectSearchSavedSearchRow | null> {
  const row = await getProspectSearchSavedSearch(admin, savedSearchId)
  if (!row) return null

  const workflow = parseSavedSearchWorkflowMetadata(row.metadata)
  if (workflow.discoveryMode === "discover_external") {
    return row
  }

  const count = await countProspectSearchMatchesInternal(admin, {
    query: row.query_text,
    filters: row.filters,
  })

  const now = new Date().toISOString()
  const metadata = buildSavedSearchWorkflowMetadata({
    resultCount: count,
    previousResultCount: workflow.resultCount,
    lastRefreshedAt: now,
    page: workflow.page,
    pageSize: workflow.pageSize,
    savePagination: workflow.savePagination,
    ownerLabel: workflow.ownerLabel,
    discoveryMode: workflow.discoveryMode,
  })

  return updateProspectSearchSavedSearch(admin, savedSearchId, { metadata })
}

export async function refreshAllProspectSearchSavedSearchCounts(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchSavedSearchWithWorkflow[]> {
  const rows = await listProspectSearchSavedSearches(admin)
  const refreshed: GrowthProspectSearchSavedSearchRow[] = []

  for (const row of rows) {
    const workflow = parseSavedSearchWorkflowMetadata(row.metadata)
    if (workflow.discoveryMode === "discover_external") {
      refreshed.push(row)
      continue
    }
    const updated = await refreshProspectSearchSavedSearchCount(admin, row.id)
    refreshed.push(updated ?? row)
  }

  return refreshed.map((row) => attachSavedSearchWorkflow(row))
}

export async function deleteProspectSearchSavedSearch(
  admin: SupabaseClient,
  id: string,
): Promise<boolean> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return false
  const { error } = await savedSearchesTable(admin).delete().eq("id", id)
  return !error
}

export async function buildSavedSearchMetadataOnSave(input: {
  resultCount?: number | null
  page?: number
  pageSize?: number
  savePagination?: boolean
  ownerLabel?: string | null
  discoveryMode?: GrowthProspectSearchDiscoveryMode
}): Promise<Record<string, unknown>> {
  const now = new Date().toISOString()
  return buildSavedSearchWorkflowMetadata({
    resultCount: input.resultCount ?? null,
    previousResultCount: null,
    lastRefreshedAt: now,
    page: input.savePagination ? input.page ?? 1 : null,
    pageSize: input.savePagination ? input.pageSize ?? 50 : null,
    savePagination: input.savePagination === true,
    ownerLabel: input.ownerLabel ?? null,
    discoveryMode: input.discoveryMode ?? "internal",
  })
}
