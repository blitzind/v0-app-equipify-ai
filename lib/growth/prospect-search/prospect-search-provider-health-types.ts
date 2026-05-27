/** Client-safe Provider Health dashboard types. */

import type { GrowthDiscoveryProviderControlName } from "@/lib/growth/prospect-search/prospect-search-discovery-provider-controls"
import { GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-estimation-types"

export type GrowthProspectSearchProviderHealthSnapshot = {
  qa_marker: typeof GROWTH_PROVIDER_HEALTH_DASHBOARD_QA_MARKER
  generated_at: string
  env_health: {
    google_places_key_present: boolean
    serp_key_present: boolean
  }
  provider_status: Array<{
    provider_name: string
    provider_type: GrowthDiscoveryProviderControlName
    configured: boolean
    runtime_enabled: boolean
    env_disabled: boolean
    uptime_state: "available" | "unavailable" | "disabled"
  }>
  metrics: {
    cache_entries: number
    cache_hits_today: number
    requests_today: number
    quota_failures_today: number
    average_latency_ms: number | null
    cache_hit_rate: number | null
    raw_results_returned_today: number
    normalized_results_today: number
    filtered_results_today: number
    persist_failures_today: number
  }
  recent_activity: Array<{
    id: string
    created_at: string
    query: string
    provider_names: string[]
    candidate_count: number
    query_expansion_count: number
    relaxed_retry: boolean
    fixture_fallback: boolean
    status: string
  }>
  diagnostics: string[]
  runtime_controls: Array<{
    provider_name: GrowthDiscoveryProviderControlName
    enabled: boolean
    env_disabled: boolean
  }>
}
