import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CachedProviderDiscoveryPayload,
  ProviderQueryCacheRow,
} from "@/lib/growth/provider-cache/provider-cache-types"
import { isCacheValid } from "@/lib/growth/provider-cache/provider-cache-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowFromRecord(row: Record<string, unknown>): ProviderQueryCacheRow {
  return {
    id: asString(row.id),
    provider_name: asString(row.provider_name),
    query_hash: asString(row.query_hash),
    normalized_query: asString(row.normalized_query),
    query_input_json:
      row.query_input_json && typeof row.query_input_json === "object"
        ? (row.query_input_json as Record<string, unknown>)
        : {},
    response_summary: asString(row.response_summary) || null,
    candidate_count: typeof row.candidate_count === "number" ? row.candidate_count : 0,
    cached_result_json:
      row.cached_result_json && typeof row.cached_result_json === "object"
        ? (row.cached_result_json as Record<string, unknown>)
        : {},
    provider_latency_ms:
      typeof row.provider_latency_ms === "number" ? row.provider_latency_ms : null,
    provider_cost_estimate:
      typeof row.provider_cost_estimate === "number" ? row.provider_cost_estimate : null,
    cache_hit_count: typeof row.cache_hit_count === "number" ? row.cache_hit_count : 0,
    created_at: asString(row.created_at),
    expires_at: asString(row.expires_at),
    last_used_at: asString(row.last_used_at),
  }
}

export async function getCachedProviderResponse(
  admin: SupabaseClient,
  providerName: string,
  queryHash: string,
): Promise<ProviderQueryCacheRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("*")
    .eq("provider_name", providerName)
    .eq("query_hash", queryHash)
    .maybeSingle()

  if (error || !data) return null
  const row = rowFromRecord(data as Record<string, unknown>)
  if (!isCacheValid(row)) return null
  return row
}

export async function incrementCacheHit(
  admin: SupabaseClient,
  rowId: string,
): Promise<void> {
  const { data } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("cache_hit_count")
    .eq("id", rowId)
    .maybeSingle()

  const current =
    data && typeof (data as Record<string, unknown>).cache_hit_count === "number"
      ? ((data as Record<string, unknown>).cache_hit_count as number)
      : 0

  await admin
    .schema("growth")
    .from("provider_query_cache")
    .update({
      cache_hit_count: current + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", rowId)
}

export async function saveProviderResponse(
  admin: SupabaseClient,
  input: {
    provider_name: string
    query_hash: string
    normalized_query: string
    query_input_json: Record<string, unknown>
    response_summary: string | null
    candidate_count: number
    cached_result_json: CachedProviderDiscoveryPayload
    provider_latency_ms: number
    provider_cost_estimate: number
    expires_at: string
  },
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from("provider_query_cache")
    .upsert(
      {
        provider_name: input.provider_name,
        query_hash: input.query_hash,
        normalized_query: input.normalized_query,
        query_input_json: input.query_input_json,
        response_summary: input.response_summary,
        candidate_count: input.candidate_count,
        cached_result_json: input.cached_result_json,
        provider_latency_ms: input.provider_latency_ms,
        provider_cost_estimate: input.provider_cost_estimate,
        expires_at: input.expires_at,
        last_used_at: now,
        cache_hit_count: 0,
      },
      { onConflict: "provider_name,query_hash" },
    )
}

export function readCachedCandidates(
  row: ProviderQueryCacheRow,
): CachedProviderDiscoveryPayload["candidates"] {
  const payload = row.cached_result_json
  if (!payload || typeof payload !== "object") return []
  const candidates = (payload as CachedProviderDiscoveryPayload).candidates
  return Array.isArray(candidates) ? candidates : []
}
