import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { clearProspectSearchEstimateCache } from "@/lib/growth/prospect-search/prospect-search-estimation-cache"
import {
  isDiscoveryProviderRuntimeEnabled,
  listDiscoveryProviderRuntimeControls,
  resetDiscoveryProviderRuntimeControls,
  setDiscoveryProviderRuntimeEnabled,
  type GrowthDiscoveryProviderControlName,
} from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import { diagnoseGrowthProspectSearchSchema } from "@/lib/growth/prospect-search/prospect-search-schema-health"
import {
  isGooglePlacesApiKeyConfigured,
  isSerpApiKeyConfigured,
} from "@/lib/growth/prospect-search/prospect-search-provider-runtime-diagnostics"
import { GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-estimation-types"
import type { GrowthProspectSearchProviderHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-provider-health-types"
import { isGrowthProviderCacheSchemaReady } from "@/lib/growth/provider-cache/provider-cache-schema-health"
import { isGrowthRealWorldDiscoverySchemaReady } from "@/lib/growth/real-world-discovery/real-world-discovery-schema-health"
import { listRealWorldDiscoveryProviders } from "@/lib/growth/real-world-discovery/real-world-discovery-registry"

export type { GrowthProspectSearchProviderHealthSnapshot } from "@/lib/growth/prospect-search/prospect-search-provider-health-types"

function startOfUtcDayIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function loadGrowthProspectSearchProviderHealth(
  admin: SupabaseClient,
): Promise<GrowthProspectSearchProviderHealthSnapshot> {
  const since = startOfUtcDayIso()
  const diagnostics: string[] = []

  const [schemaHealth, cacheReady, discoveryReady] = await Promise.all([
    diagnoseGrowthProspectSearchSchema(admin),
    isGrowthProviderCacheSchemaReady(admin),
    isGrowthRealWorldDiscoverySchemaReady(admin),
  ])

  if (!schemaHealth.ready) diagnostics.push(schemaHealth.message)
  if (!cacheReady) diagnostics.push("Provider query cache schema not ready.")
  if (!discoveryReady) diagnostics.push("Real-world discovery schema not ready.")

  const runtime_controls = listDiscoveryProviderRuntimeControls()
  const providers = listRealWorldDiscoveryProviders({ admin }).filter((row) =>
    ["google_places", "serp"].includes(row.provider_type),
  )

  const provider_status = providers.map((provider) => {
    const control = runtime_controls.find((row) => row.provider_name === provider.provider_type)
    const configured = provider.isConfigured()
    const runtime_enabled = control?.enabled ?? true
    const env_disabled = control?.env_disabled ?? false
    let uptime_state: "available" | "unavailable" | "disabled" = "unavailable"
    if (!runtime_enabled || env_disabled) uptime_state = "disabled"
    else if (configured) uptime_state = "available"
    return {
      provider_name: provider.provider_name,
      provider_type: provider.provider_type as GrowthDiscoveryProviderControlName,
      configured,
      runtime_enabled,
      env_disabled,
      uptime_state,
    }
  })

  let cache_entries = 0
  let cache_hits_today = 0
  let average_latency_ms: number | null = null
  let cache_hit_rate: number | null = null

  if (cacheReady) {
    const { count } = await admin
      .schema("growth")
      .from("provider_query_cache")
      .select("id", { count: "exact", head: true })
    cache_entries = count ?? 0

    const { data: cacheRows } = await admin
      .schema("growth")
      .from("provider_query_cache")
      .select("cache_hit_count, provider_latency_ms, created_at")
      .gte("last_used_at", since)
      .limit(500)

    const rows = cacheRows ?? []
    cache_hits_today = rows.reduce(
      (sum, row) =>
        sum +
        (typeof (row as Record<string, unknown>).cache_hit_count === "number"
          ? ((row as Record<string, unknown>).cache_hit_count as number)
          : 0),
      0,
    )
    const latencies = rows
      .map((row) => (row as Record<string, unknown>).provider_latency_ms)
      .filter((value): value is number => typeof value === "number" && value > 0)
    if (latencies.length) {
      average_latency_ms = Math.round(
        latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
      )
    }
    const liveRequests = rows.length
    if (liveRequests + cache_hits_today > 0) {
      cache_hit_rate = Math.round((cache_hits_today / (liveRequests + cache_hits_today)) * 100)
    }
  }

  let requests_today = 0
  let raw_results_returned_today = 0
  let normalized_results_today = 0
  let filtered_results_today = 0
  let persist_failures_today = 0
  let quota_failures_today = 0
  const recent_activity: GrowthProspectSearchProviderHealthSnapshot["recent_activity"] = []

  if (discoveryReady) {
    const { data: runs } = await admin
      .schema("growth")
      .from("real_world_discovery_runs")
      .select("id, created_at, query, provider_names, candidate_count, status, metadata, error_message")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(25)

    for (const row of runs ?? []) {
      const record = row as Record<string, unknown>
      const metadata =
        record.metadata && typeof record.metadata === "object"
          ? (record.metadata as Record<string, unknown>)
          : {}
      const providerDiagnostics = Array.isArray(metadata.provider_diagnostics)
        ? metadata.provider_diagnostics
        : []
      requests_today += 1
      raw_results_returned_today += providerDiagnostics.reduce((sum: number, item: unknown) => {
        if (!item || typeof item !== "object") return sum
        const diag = item as Record<string, unknown>
        return (
          sum +
          (typeof diag.provider_merged_result_count === "number"
            ? diag.provider_merged_result_count
            : typeof diag.provider_result_count === "number"
              ? diag.provider_result_count
              : 0)
        )
      }, 0)
      normalized_results_today +=
        typeof metadata.normalized_result_count === "number" ? metadata.normalized_result_count : 0
      filtered_results_today +=
        typeof metadata.filtered_result_count === "number" ? metadata.filtered_result_count : 0
      if (metadata.persist_warning) persist_failures_today += 1
      const errorMessage = asString(record.error_message)
      if (/quota|rate.?limit|429/i.test(errorMessage)) quota_failures_today += 1

      recent_activity.push({
        id: asString(record.id),
        created_at: asString(record.created_at),
        query: asString(record.query),
        provider_names: Array.isArray(record.provider_names)
          ? (record.provider_names as string[])
          : [],
        candidate_count:
          typeof record.candidate_count === "number" ? record.candidate_count : 0,
        query_expansion_count: Array.isArray(metadata.query_expansion)
          ? metadata.query_expansion.length
          : 0,
        relaxed_retry: metadata.used_relaxed_filters === true,
        fixture_fallback: metadata.fixture_active === true,
        status: asString(record.status) || "unknown",
      })
    }
  }

  if (persist_failures_today > 0) {
    diagnostics.push(`${persist_failures_today} discovery run(s) reported persistence warnings today.`)
  }
  if (quota_failures_today > 0) {
    diagnostics.push(`${quota_failures_today} run(s) hit provider rate limits today.`)
  }
  if (!isGooglePlacesApiKeyConfigured() && !isSerpApiKeyConfigured()) {
    diagnostics.push("No live discovery API keys configured.")
  }

  return {
    qa_marker: GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER,
    generated_at: new Date().toISOString(),
    env_health: {
      google_places_key_present: isGooglePlacesApiKeyConfigured(),
      serp_key_present: isSerpApiKeyConfigured(),
    },
    provider_status,
    metrics: {
      cache_entries,
      cache_hits_today,
      requests_today,
      quota_failures_today,
      average_latency_ms,
      cache_hit_rate,
      raw_results_returned_today,
      normalized_results_today,
      filtered_results_today,
      persist_failures_today,
    },
    recent_activity,
    diagnostics,
    runtime_controls,
  }
}

export async function clearGrowthProviderQueryCache(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .delete()
    .in("provider_name", ["google_places", "serp"])
    .select("id")

  clearProspectSearchEstimateCache()
  if (error) return 0
  return data?.length ?? 0
}

export async function testGrowthDiscoveryProvider(
  admin: SupabaseClient,
  providerName: GrowthDiscoveryProviderControlName,
): Promise<{ ok: boolean; message: string; latency_ms: number }> {
  const started = performance.now()
  const provider = listRealWorldDiscoveryProviders({ admin }).find(
    (row) => row.provider_type === providerName,
  )
  if (!provider) {
    return { ok: false, message: "Unknown provider.", latency_ms: 0 }
  }
  if (!isDiscoveryProviderRuntimeEnabled(providerName)) {
    return { ok: false, message: "Provider is disabled.", latency_ms: 0 }
  }
  if (!provider.isConfigured()) {
    return {
      ok: false,
      message: "Provider key missing — configure env vars first.",
      latency_ms: Math.round(performance.now() - started),
    }
  }

  const { data } = await admin
    .schema("growth")
    .from("provider_query_cache")
    .select("id, candidate_count, last_used_at")
    .eq("provider_name", providerName)
    .order("last_used_at", { ascending: false })
    .limit(1)

  const cacheRow = data?.[0] as Record<string, unknown> | undefined
  const cacheCount =
    cacheRow && typeof cacheRow.candidate_count === "number" ? cacheRow.candidate_count : 0

  return {
    ok: true,
    message: `Provider configured. Latest cache entry returned ${cacheCount} candidate(s) — no live API call made.`,
    latency_ms: Math.round(performance.now() - started),
  }
}

export function applyGrowthDiscoveryProviderToggle(
  providerName: GrowthDiscoveryProviderControlName,
  enabled: boolean,
): void {
  setDiscoveryProviderRuntimeEnabled(providerName, enabled)
  clearProspectSearchEstimateCache()
}

export function rerunGrowthProviderHealthDiagnostics(): void {
  resetDiscoveryProviderRuntimeControls()
  clearProspectSearchEstimateCache()
}