/** Client-safe provider runtime diagnostics for Prospect Search external discovery. */

import type { GrowthProspectSearchExternalFilterDiagnostics } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import type { GrowthProspectSearchProviderDiagnostic } from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER =
  "growth-provider-runtime-diagnostics-v1" as const

export const GROWTH_PROVIDER_RELAXED_FILTER_RETRY_QA_MARKER =
  "growth-provider-relaxed-filter-retry-v1" as const

export const GROWTH_PROSPECT_SEARCH_PROVIDER_STATUS_LABELS = [
  "live_provider_active",
  "provider_key_missing",
  "provider_quota_rate_limited",
  "provider_returned_raw_0",
  "results_dropped_by_filters",
  "fixture_fallback_active",
  "no_provider_configured",
] as const

export type GrowthProspectSearchProviderStatusLabel =
  (typeof GROWTH_PROSPECT_SEARCH_PROVIDER_STATUS_LABELS)[number]

export type GrowthProspectSearchProviderRuntimeDiagnostics = {
  qa_marker: typeof GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER
  provider_status_label: GrowthProspectSearchProviderStatusLabel
  provider_status_message: string
  google_places_key_present: boolean
  serp_key_present: boolean
  providers_selected: string[]
  query_expansion: string[]
  raw_result_count: number
  normalized_result_count: number
  filtered_result_count: number
  dropped_reason_counts: Record<string, number>
  used_relaxed_filters: boolean
  provider_diagnostics: GrowthProspectSearchProviderDiagnostic[]
}

export function isGooglePlacesApiKeyConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim())
}

export function isSerpApiKeyConfigured(): boolean {
  return Boolean(
    process.env.SERPAPI_API_KEY?.trim() ||
      process.env.SERP_API_KEY?.trim() ||
      process.env.SERPAPI_KEY?.trim(),
  )
}

export function deriveProspectSearchProviderStatus(input: {
  google_places_key_present: boolean
  serp_key_present: boolean
  raw_result_count: number
  filtered_result_count: number
  fixture_active: boolean
  provider_diagnostics: GrowthProspectSearchProviderDiagnostic[]
  used_relaxed_filters: boolean
}): { label: GrowthProspectSearchProviderStatusLabel; message: string } {
  const anyLiveKey = input.google_places_key_present || input.serp_key_present
  const anyExecuted = input.provider_diagnostics.some((row) => row.provider_executed)
  const anyQuota = input.provider_diagnostics.some((row) =>
    /quota|rate.?limit|429|resource_exhausted/i.test(row.provider_fallback_reason ?? ""),
  )

  if (input.fixture_active && !anyLiveKey) {
    return {
      label: "fixture_fallback_active",
      message: "Fixture fallback active — no live provider API keys configured.",
    }
  }

  if (anyQuota) {
    return {
      label: "provider_quota_rate_limited",
      message: "Provider quota or rate limit reached — try again later or narrow the query.",
    }
  }

  if (input.raw_result_count === 0 && anyExecuted) {
    return {
      label: "provider_returned_raw_0",
      message: "Live providers executed but returned zero raw matches for the expanded queries.",
    }
  }

  if (!anyLiveKey) {
    return {
      label: "provider_key_missing",
      message:
        "Provider key missing — set GOOGLE_PLACES_API_KEY and/or SERPAPI_API_KEY (or SERP_API_KEY) to enable live discovery.",
    }
  }

  if (input.raw_result_count > 0 && input.filtered_result_count === 0) {
    return {
      label: "results_dropped_by_filters",
      message: input.used_relaxed_filters
        ? "Showing provider matches with incomplete firmographic data after a relaxed filter retry."
        : "Provider returned matches but ICP filters removed all results — try relaxing employee/revenue or technology filters.",
    }
  }

  if (input.raw_result_count > 0 && input.filtered_result_count > 0) {
    if (input.used_relaxed_filters) {
      return {
        label: "results_dropped_by_filters",
        message:
          "Showing provider matches with incomplete firmographic data after a relaxed filter retry.",
      }
    }
    return {
      label: "live_provider_active",
      message: `Live provider active — ${input.filtered_result_count} match(es) after filters.`,
    }
  }

  if (anyLiveKey && !anyExecuted) {
    return {
      label: "provider_key_missing",
      message: "Provider keys are set but no live provider executed — verify env vars in this deployment.",
    }
  }

  return {
    label: "no_provider_configured",
    message: "No usable live provider configured for external discovery.",
  }
}

export function buildProspectSearchProviderRuntimeDiagnostics(input: {
  provider_diagnostics: GrowthProspectSearchProviderDiagnostic[]
  query_expansion: string[]
  raw_result_count: number
  normalized_result_count: number
  filtered_result_count: number
  filter_diagnostics?: GrowthProspectSearchExternalFilterDiagnostics
  used_relaxed_filters: boolean
  fixture_active: boolean
}): GrowthProspectSearchProviderRuntimeDiagnostics {
  const google_places_key_present = isGooglePlacesApiKeyConfigured()
  const serp_key_present = isSerpApiKeyConfigured()
  const providers_selected = input.provider_diagnostics.map((row) => row.provider_name)

  const status = deriveProspectSearchProviderStatus({
    google_places_key_present,
    serp_key_present,
    raw_result_count: input.raw_result_count,
    filtered_result_count: input.filtered_result_count,
    fixture_active: input.fixture_active,
    provider_diagnostics: input.provider_diagnostics,
    used_relaxed_filters: input.used_relaxed_filters,
  })

  return {
    qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
    provider_status_label: status.label,
    provider_status_message: status.message,
    google_places_key_present,
    serp_key_present,
    providers_selected,
    query_expansion: input.query_expansion,
    raw_result_count: input.raw_result_count,
    normalized_result_count: input.normalized_result_count,
    filtered_result_count: input.filtered_result_count,
    dropped_reason_counts: input.filter_diagnostics?.dropped_reasons ?? {},
    used_relaxed_filters: input.used_relaxed_filters,
    provider_diagnostics: input.provider_diagnostics,
  }
}
