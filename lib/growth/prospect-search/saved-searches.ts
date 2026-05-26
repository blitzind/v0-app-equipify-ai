import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-filters"
import { isGrowthProspectSearchSchemaReady } from "@/lib/growth/prospect-search/prospect-search-schema-health"
import type {
  GrowthProspectSearchFilters,
  GrowthProspectSearchSavedSearchRow,
} from "@/lib/growth/prospect-search/prospect-search-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
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
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50)
  if (error) return []
  return (data ?? []).map((row) => mapSavedSearchRow(row as Record<string, unknown>))
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
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return null
  const { data, error } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .insert({
      created_by: input.created_by ?? null,
      name: input.name.trim().slice(0, 120),
      query_text: input.query_text.trim().slice(0, 300),
      filters: normalizeProspectSearchFilters(input.filters),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error || !data) return null
  return mapSavedSearchRow(data as Record<string, unknown>)
}

export async function deleteProspectSearchSavedSearch(
  admin: SupabaseClient,
  id: string,
): Promise<boolean> {
  if (!(await isGrowthProspectSearchSchemaReady(admin))) return false
  const { error } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .delete()
    .eq("id", id)
  return !error
}
