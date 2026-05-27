/** Growth Engine — Real-world discovery provider contracts (Prompt 29). */

import type {
  GrowthRealWorldDiscoveryAttribution,
  GrowthRealWorldDiscoveryEvidence,
} from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type { GrowthRealWorldDiscoverySearchInputs } from "@/lib/growth/real-world-discovery/real-world-discovery-query-builder"

export const GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES = [
  "google_places",
  "serp",
  "business_directory",
  "manual_import",
  "fixture",
] as const

export type GrowthRealWorldDiscoveryProviderType =
  (typeof GROWTH_REAL_WORLD_DISCOVERY_PROVIDER_TYPES)[number]

export const GROWTH_REAL_WORLD_LIVE_PROVIDER_TYPES = [
  "google_places",
  "serp",
  "business_directory",
  "manual_import",
] as const

export type GrowthRealWorldDiscoveryQuery = GrowthRealWorldDiscoverySearchInputs & {
  /** Natural-language query sent to providers. */
  query: string
  limit?: number
}

export type GrowthRealWorldDiscoveryProviderRawCandidate = {
  company_name: string
  website?: string | null
  domain?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  category?: string | null
  description?: string | null
  industry?: string | null
  location?: string | null
  rating?: number | null
  review_count?: number | null
  source_url?: string | null
  source_rank?: number | null
  confidence?: number | null
  evidence: GrowthRealWorldDiscoveryEvidence[]
  source_attribution: GrowthRealWorldDiscoveryAttribution[]
  raw_payload_server_only?: Record<string, unknown>
}

export type GrowthRealWorldDiscoveryProviderResult = {
  provider_name: string
  provider_type: GrowthRealWorldDiscoveryProviderType
  status: "success" | "skipped" | "failed"
  message: string
  candidates: GrowthRealWorldDiscoveryProviderRawCandidate[]
  error?: string | null
  diagnostics?: GrowthRealWorldDiscoveryProviderDiagnostics
}

export type GrowthRealWorldDiscoveryProviderDiagnostics = {
  provider_executed: boolean
  provider_latency_ms: number
  provider_result_count: number
  provider_fallback_reason?: string | null
  provider_query_generated?: string[]
  provider_query_result_count?: number[]
  provider_merged_result_count?: number
}

export type GrowthRealWorldDiscoveryProvider = {
  provider_name: string
  provider_type: GrowthRealWorldDiscoveryProviderType
  isConfigured: () => boolean
  discover: (input: GrowthRealWorldDiscoveryQuery) => Promise<GrowthRealWorldDiscoveryProviderResult>
}
