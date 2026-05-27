import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthRealWorldDiscoveryProvider,
  GrowthRealWorldDiscoveryProviderDiagnostics,
  GrowthRealWorldDiscoveryProviderResult,
  GrowthRealWorldDiscoveryProviderType,
  GrowthRealWorldDiscoveryQuery,
} from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import { GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES } from "@/lib/growth/real-world-discovery/real-world-discovery-provider-types"
import type {
  GrowthRealWorldProviderExecutionDiagnostic,
  GrowthRealWorldProviderStatusLabel,
  GrowthRealWorldProviderStatusSummary,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import { GROWTH_REAL_WORLD_SOURCE_BADGE_LABELS } from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import { createRealWorldBusinessDirectoryProvider } from "@/lib/growth/real-world-discovery/providers/business-directory-provider"
import { createRealWorldFixtureProvider } from "@/lib/growth/real-world-discovery/providers/fixture-provider"
import { createRealWorldGooglePlacesProvider } from "@/lib/growth/real-world-discovery/providers/google-places-provider"
import { createRealWorldManualImportProvider } from "@/lib/growth/real-world-discovery/providers/manual-import-provider"
import { createRealWorldSerpProvider } from "@/lib/growth/real-world-discovery/providers/serp-provider"

export function listRealWorldDiscoveryProviders(options?: {
  admin?: SupabaseClient | null
}): GrowthRealWorldDiscoveryProvider[] {
  const admin = options?.admin ?? null
  return [
    createRealWorldGooglePlacesProvider({ admin }),
    createRealWorldSerpProvider({ admin }),
    createRealWorldBusinessDirectoryProvider({ admin }),
    createRealWorldManualImportProvider(),
    createRealWorldFixtureProvider(),
  ]
}

export function getRealWorldDiscoveryProvider(
  providerType: GrowthRealWorldDiscoveryProviderType,
): GrowthRealWorldDiscoveryProvider | null {
  return listRealWorldDiscoveryProviders().find((p) => p.provider_type === providerType) ?? null
}

function anyLiveProviderConfigured(): boolean {
  return listRealWorldDiscoveryProviders()
    .filter((p) => GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(p.provider_type as never))
    .some((p) => p.isConfigured())
}

function mergeProviderDiagnostics(
  provider: GrowthRealWorldDiscoveryProvider,
  result: GrowthRealWorldDiscoveryProviderResult,
  latencyMs: number,
  executed: boolean,
): GrowthRealWorldDiscoveryProviderDiagnostics {
  const fallbackReason =
    result.diagnostics?.provider_fallback_reason ??
    (provider.provider_type === "fixture"
      ? "no_live_provider_configured"
      : !executed
        ? "not_configured"
        : result.status === "failed"
          ? result.error ?? result.message
          : result.status === "skipped"
            ? result.message
            : null)

  return {
    provider_executed: result.diagnostics?.provider_executed ?? executed,
    provider_latency_ms: result.diagnostics?.provider_latency_ms ?? latencyMs,
    provider_result_count: result.diagnostics?.provider_result_count ?? result.candidates.length,
    provider_fallback_reason: fallbackReason,
    provider_query_generated: result.diagnostics?.provider_query_generated,
    provider_query_result_count: result.diagnostics?.provider_query_result_count,
    provider_merged_result_count: result.diagnostics?.provider_merged_result_count,
    provider_cache_hit: result.diagnostics?.provider_cache_hit,
    provider_cache_age_ms: result.diagnostics?.provider_cache_age_ms,
    provider_cost_estimate: result.diagnostics?.provider_cost_estimate,
    provider_live_request_count: result.diagnostics?.provider_live_request_count,
    provider_cache_hit_count: result.diagnostics?.provider_cache_hit_count,
  }
}

function toExecutionDiagnostic(
  result: GrowthRealWorldDiscoveryProviderResult,
): GrowthRealWorldProviderExecutionDiagnostic {
  return {
    provider_type: result.provider_type,
    provider_name: result.provider_name,
    provider_executed: result.diagnostics?.provider_executed ?? false,
    provider_latency_ms: result.diagnostics?.provider_latency_ms ?? 0,
    provider_result_count: result.diagnostics?.provider_result_count ?? result.candidates.length,
    provider_fallback_reason: result.diagnostics?.provider_fallback_reason ?? null,
    provider_query_generated: result.diagnostics?.provider_query_generated,
    provider_query_result_count: result.diagnostics?.provider_query_result_count,
    provider_merged_result_count: result.diagnostics?.provider_merged_result_count,
    provider_cache_hit: result.diagnostics?.provider_cache_hit,
    provider_cache_age_ms: result.diagnostics?.provider_cache_age_ms,
    provider_cost_estimate: result.diagnostics?.provider_cost_estimate,
    provider_live_request_count: result.diagnostics?.provider_live_request_count,
    provider_cache_hit_count: result.diagnostics?.provider_cache_hit_count,
  }
}

export function summarizeRealWorldProviderStatus(
  results: GrowthRealWorldDiscoveryProviderResult[],
  options?: { use_fixture_fallback?: boolean },
): GrowthRealWorldProviderStatusSummary {
  const liveConfigured = anyLiveProviderConfigured()
  const liveActive = results.some(
    (r) =>
      GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(r.provider_type as never) &&
      r.status === "success" &&
      r.candidates.length > 0,
  )
  const fixtureActive = results.some(
    (r) => r.provider_type === "fixture" && r.status === "success" && r.candidates.length > 0,
  )
  const live_providers = results
    .filter(
      (r) =>
        GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(r.provider_type as never) &&
        r.status === "success",
    )
    .map((r) => GROWTH_REAL_WORLD_SOURCE_BADGE_LABELS[r.provider_type] ?? r.provider_name)

  const provider_diagnostics = results.map(toExecutionDiagnostic)
  const provider_fallback_reason = fixtureActive
    ? "no_live_provider_configured"
    : options?.use_fixture_fallback
      ? "no_live_provider_configured"
      : null

  let label: GrowthRealWorldProviderStatusLabel = "no_provider_configured"
  let message = "No live provider configured — enable API keys or use fixture fallback."

  if (liveActive) {
    label = "live_provider_active"
    message = `Live provider active: ${live_providers.join(", ") || "configured"}.`
  } else if (fixtureActive) {
    label = "fixture_fallback_active"
    message = "Fixture fallback active — no live public-source API configured."
  } else if (liveConfigured) {
    label = "live_provider_active"
    message = "No companies found after expanded provider search. Try adding a location or broadening filters."
  }

  return {
    label,
    message,
    live_providers,
    fixture_active: fixtureActive,
    provider_diagnostics,
    provider_fallback_reason,
  }
}

/** Run providers; failures isolated. Fixture only when no live provider is configured. */
export async function runRealWorldDiscoveryProviders(
  input: GrowthRealWorldDiscoveryQuery,
  options?: { admin?: SupabaseClient | null },
): Promise<GrowthRealWorldDiscoveryProviderResult[]> {
  const all = listRealWorldDiscoveryProviders({ admin: options?.admin ?? null })
  const useFixtureFallback = !anyLiveProviderConfigured()

  const toRun = all.filter((p) => {
    if (p.provider_type === "fixture") return useFixtureFallback
    return GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES.includes(p.provider_type as never)
  })

  const results: GrowthRealWorldDiscoveryProviderResult[] = []

  for (const provider of toRun) {
    if (!provider.isConfigured() && provider.provider_type !== "fixture") {
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "skipped",
        message: `${provider.provider_name} not configured.`,
        candidates: [],
        diagnostics: mergeProviderDiagnostics(
          provider,
          {
            provider_name: provider.provider_name,
            provider_type: provider.provider_type,
            status: "skipped",
            message: `${provider.provider_name} not configured.`,
            candidates: [],
          },
          0,
          false,
        ),
      })
      continue
    }

    const started = performance.now()
    try {
      const result = await provider.discover(input)
      const latencyMs = Math.round(performance.now() - started)
      results.push({
        ...result,
        diagnostics: mergeProviderDiagnostics(provider, result, latencyMs, true),
      })
    } catch (err) {
      const latencyMs = Math.round(performance.now() - started)
      const message = err instanceof Error ? err.message : "Provider failed."
      results.push({
        provider_name: provider.provider_name,
        provider_type: provider.provider_type,
        status: "failed",
        message,
        candidates: [],
        error: message,
        diagnostics: {
          provider_executed: true,
          provider_latency_ms: latencyMs,
          provider_result_count: 0,
          provider_fallback_reason: message,
        },
      })
    }
  }

  return results
}

export function anyRealWorldLiveProviderConfigured(): boolean {
  return anyLiveProviderConfigured()
}
