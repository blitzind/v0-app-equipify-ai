import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateSignalWatchlist } from "@/lib/growth/signals/signal-trigger-evaluator"
import {
  GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
  normalizeSignalWatchlistFilters,
  type GrowthSignalWatchlistFilters,
  type GrowthSignalWatchlistRow,
} from "@/lib/growth/signals/signal-watchlist-types"
import {
  GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE,
  isGrowthSignalWatchlistSchemaReady,
} from "@/lib/growth/signals/signal-watchlist-schema-health"
import {
  GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE,
  isGrowthSignalFoundationSchemaReady,
} from "@/lib/growth/signals/signal-schema-health"
import { stripInternalSignalFields } from "@/lib/growth/signals/signal-api-sanitize"
import type { GrowthSignalRow, GrowthSignalType } from "@/lib/growth/signals/signal-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNullableString(value: unknown): string | null {
  const text = asString(value)
  return text || null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function parseMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function parseSignalTypes(value: unknown): GrowthSignalType[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is GrowthSignalType => typeof entry === "string" && entry.trim().length > 0)
}

function mapWatchlistRow(row: Record<string, unknown>): GrowthSignalWatchlistRow {
  return {
    id: asString(row.id),
    organization_id: asNullableString(row.organization_id),
    name: asString(row.name),
    description: asNullableString(row.description),
    signal_types: parseSignalTypes(row.signal_types),
    filters: normalizeSignalWatchlistFilters(
      row.filters && typeof row.filters === "object" ? (row.filters as GrowthSignalWatchlistFilters) : {},
    ),
    match_count: asNumber(row.match_count),
    last_evaluated_at: asNullableString(row.last_evaluated_at),
    created_by: asNullableString(row.created_by),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    archived_at: asNullableString(row.archived_at),
    metadata: parseMetadata(row.metadata),
  }
}

function mapSignalRow(row: Record<string, unknown>): GrowthSignalRow {
  return stripInternalSignalFields({
    id: asString(row.id),
    organization_id: asNullableString(row.organization_id),
    signal_type: asString(row.signal_type) as GrowthSignalType,
    provider_key: asString(row.provider_key),
    provider_event_id: asNullableString(row.provider_event_id),
    dedupe_hash: asString(row.dedupe_hash),
    confidence: asNumber(row.confidence),
    signal_score: asNumber(row.signal_score),
    urgency: asString(row.urgency) as GrowthSignalRow["urgency"],
    routing_priority: asNumber(row.routing_priority),
    occurred_at: asString(row.occurred_at),
    detected_at: asString(row.detected_at),
    expires_at: asNullableString(row.expires_at),
    company_id: asNullableString(row.company_id),
    company_name: asString(row.company_name),
    domain: asNullableString(row.domain),
    contact_id: asNullableString(row.contact_id),
    contact_display_label: asNullableString(row.contact_display_label),
    title: asNullableString(row.title),
    previous_title: asNullableString(row.previous_title),
    seniority: asNullableString(row.seniority),
    geography: asNullableString(row.geography),
    industry: asNullableString(row.industry),
    category: asNullableString(row.category),
    evidence_summary: asString(row.evidence_summary),
    workflow_state: asString(row.workflow_state) as GrowthSignalRow["workflow_state"],
    suppression_state: asString(row.suppression_state) as GrowthSignalRow["suppression_state"],
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata: parseMetadata(row.metadata),
  })
}

function watchlistsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("signal_watchlists")
}

export async function listGrowthSignalWatchlists(
  admin: SupabaseClient,
  input: { organization_id?: string | null; include_archived?: boolean } = {},
): Promise<GrowthSignalWatchlistRow[]> {
  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return []

  let query = watchlistsTable(admin).select("*").order("updated_at", { ascending: false }).limit(100)
  if (!input.include_archived) query = query.is("archived_at", null)
  if (input.organization_id) query = query.eq("organization_id", input.organization_id)

  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row) => mapWatchlistRow(row as Record<string, unknown>))
}

export async function getGrowthSignalWatchlist(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthSignalWatchlistRow | null> {
  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return null
  const { data, error } = await watchlistsTable(admin).select("*").eq("id", id).maybeSingle()
  if (error || !data) return null
  return mapWatchlistRow(data as Record<string, unknown>)
}

export async function createGrowthSignalWatchlist(
  admin: SupabaseClient,
  input: {
    organization_id?: string | null
    created_by?: string | null
    name: string
    description?: string | null
    signal_types?: GrowthSignalType[]
    filters?: Partial<GrowthSignalWatchlistFilters>
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSignalWatchlistRow | null> {
  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return null

  const name = input.name.trim().slice(0, 120)
  if (!name) return null

  const { data, error } = await watchlistsTable(admin)
    .insert({
      organization_id: input.organization_id ?? null,
      created_by: input.created_by ?? null,
      name,
      description: input.description?.trim().slice(0, 500) ?? null,
      signal_types: input.signal_types ?? [],
      filters: normalizeSignalWatchlistFilters(input.filters),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error || !data) return null
  return mapWatchlistRow(data as Record<string, unknown>)
}

export async function updateGrowthSignalWatchlist(
  admin: SupabaseClient,
  id: string,
  input: {
    name?: string
    description?: string | null
    signal_types?: GrowthSignalType[]
    filters?: Partial<GrowthSignalWatchlistFilters>
    metadata?: Record<string, unknown>
    archive?: boolean
  },
): Promise<GrowthSignalWatchlistRow | null> {
  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return null

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 120)
    if (!name) return null
    patch.name = name
  }
  if (input.description !== undefined) patch.description = input.description?.trim().slice(0, 500) ?? null
  if (input.signal_types !== undefined) patch.signal_types = input.signal_types
  if (input.filters !== undefined) patch.filters = normalizeSignalWatchlistFilters(input.filters)
  if (input.metadata !== undefined) patch.metadata = input.metadata
  if (input.archive === true) patch.archived_at = new Date().toISOString()

  const { data, error } = await watchlistsTable(admin).update(patch).eq("id", id).select("*").single()
  if (error || !data) return null
  return mapWatchlistRow(data as Record<string, unknown>)
}

async function loadSignalsForWatchlistEvaluation(
  admin: SupabaseClient,
  watchlist: GrowthSignalWatchlistRow,
): Promise<GrowthSignalRow[]> {
  const allowedTypes =
    watchlist.signal_types.length > 0
      ? watchlist.signal_types
      : watchlist.filters.signal_types?.length
        ? watchlist.filters.signal_types
        : []

  let query = admin
    .schema("growth")
    .from("signals")
    .select(
      "id, organization_id, signal_type, provider_key, provider_event_id, dedupe_hash, confidence, signal_score, urgency, routing_priority, occurred_at, detected_at, expires_at, company_id, company_name, domain, contact_id, contact_display_label, title, previous_title, seniority, geography, industry, category, evidence_summary, workflow_state, suppression_state, created_at, updated_at, metadata",
    )
    .order("occurred_at", { ascending: false })
    .limit(2000)

  if (watchlist.organization_id) query = query.eq("organization_id", watchlist.organization_id)
  if (allowedTypes.length === 1) query = query.eq("signal_type", allowedTypes[0]!)
  else if (allowedTypes.length > 1) query = query.in("signal_type", allowedTypes)

  const filters = watchlist.filters
  if (filters.workflow_state) query = query.eq("workflow_state", filters.workflow_state)
  if (filters.suppression_state) query = query.eq("suppression_state", filters.suppression_state)
  if (filters.urgency) query = query.eq("urgency", filters.urgency)
  if (filters.minimum_signal_score != null) query = query.gte("signal_score", filters.minimum_signal_score)
  if (filters.company) query = query.ilike("company_name", `%${filters.company}%`)
  if (filters.domain) query = query.ilike("domain", `%${filters.domain}%`)
  if (filters.category) query = query.eq("category", filters.category)
  if (filters.occurred_from) query = query.gte("occurred_at", filters.occurred_from)
  if (filters.occurred_to) query = query.lte("occurred_at", filters.occurred_to)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSignalRow(row as Record<string, unknown>))
}

export type RefreshSignalWatchlistMatchesResult = {
  ok: boolean
  qa_marker: typeof GROWTH_SIGNAL_WATCHLISTS_QA_MARKER
  watchlist?: GrowthSignalWatchlistRow
  match_count?: number
  matched_signal_ids?: string[]
  message?: string
  error?: string
}

export async function refreshSignalWatchlistMatches(
  admin: SupabaseClient,
  watchlistId: string,
): Promise<RefreshSignalWatchlistMatchesResult> {
  const base = { qa_marker: GROWTH_SIGNAL_WATCHLISTS_QA_MARKER } as const

  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) {
    return { ...base, ok: false, error: "schema_not_ready", message: GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE }
  }
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ...base, ok: false, error: "schema_not_ready", message: GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE }
  }

  const watchlist = await getGrowthSignalWatchlist(admin, watchlistId)
  if (!watchlist || watchlist.archived_at) {
    return { ...base, ok: false, error: "not_found", message: "Watchlist not found." }
  }

  const signals = await loadSignalsForWatchlistEvaluation(admin, watchlist)
  const matches = evaluateSignalWatchlist(watchlist, signals)
  const matchedIds = matches.map((entry) => entry.signal.id)
  const now = new Date().toISOString()

  if (matches.length > 0) {
    const rows = matches.map((entry) => ({
      watchlist_id: watchlistId,
      signal_id: entry.signal.id,
      organization_id: entry.signal.organization_id ?? watchlist.organization_id ?? null,
      matched_at: now,
      match_reason: entry.reason,
    }))
    const { error: upsertError } = await admin
      .schema("growth")
      .from("signal_watchlist_matches")
      .upsert(rows, { onConflict: "watchlist_id,signal_id" })
    if (upsertError) return { ...base, ok: false, error: "db_error", message: upsertError.message }
  }

  if (matchedIds.length === 0) {
    await admin.schema("growth").from("signal_watchlist_matches").delete().eq("watchlist_id", watchlistId)
  } else {
    const { data: existing } = await admin
      .schema("growth")
      .from("signal_watchlist_matches")
      .select("signal_id")
      .eq("watchlist_id", watchlistId)
    const staleIds = (existing ?? [])
      .map((row) => asString(row.signal_id))
      .filter((id) => id && !matchedIds.includes(id))
    if (staleIds.length > 0) {
      await admin
        .schema("growth")
        .from("signal_watchlist_matches")
        .delete()
        .eq("watchlist_id", watchlistId)
        .in("signal_id", staleIds)
    }
  }

  const { data: updated, error: updateError } = await watchlistsTable(admin)
    .update({
      match_count: matchedIds.length,
      last_evaluated_at: now,
    })
    .eq("id", watchlistId)
    .select("*")
    .single()

  if (updateError || !updated) {
    return { ...base, ok: false, error: "db_error", message: updateError?.message ?? "update_failed" }
  }

  return {
    ...base,
    ok: true,
    watchlist: mapWatchlistRow(updated as Record<string, unknown>),
    match_count: matchedIds.length,
    matched_signal_ids: matchedIds,
    message: `Watchlist refreshed — ${matchedIds.length} matching signal(s).`,
  }
}

export type WatchlistMetricsSnapshot = {
  active_watchlists: number
  matches_last_24h: number
  top_watchlists: Array<{ id: string; name: string; match_count: number }>
  high_urgency_unmatched: number
}

export async function loadWatchlistMetricsSnapshot(
  admin: SupabaseClient,
): Promise<WatchlistMetricsSnapshot> {
  const empty: WatchlistMetricsSnapshot = {
    active_watchlists: 0,
    matches_last_24h: 0,
    top_watchlists: [],
    high_urgency_unmatched: 0,
  }

  if (!(await isGrowthSignalWatchlistSchemaReady(admin))) return empty

  const [{ count: activeCount }, { data: topRows }, { count: matches24h }] = await Promise.all([
    watchlistsTable(admin).select("id", { count: "exact", head: true }).is("archived_at", null),
    watchlistsTable(admin)
      .select("id, name, match_count")
      .is("archived_at", null)
      .order("match_count", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("signal_watchlist_matches")
      .select("id", { count: "exact", head: true })
      .gte("matched_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ])

  let highUrgencyUnmatched = 0
  if (await isGrowthSignalFoundationSchemaReady(admin)) {
    const { count } = await admin
      .schema("growth")
      .from("signals")
      .select("id", { count: "exact", head: true })
      .in("urgency", ["high", "urgent"])
      .eq("workflow_state", "new")
      .eq("suppression_state", "active")
    highUrgencyUnmatched = count ?? 0
  }

  return {
    active_watchlists: activeCount ?? 0,
    matches_last_24h: matches24h ?? 0,
    top_watchlists: (topRows ?? []).map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      match_count: asNumber(row.match_count),
    })),
    high_urgency_unmatched: highUrgencyUnmatched,
  }
}
