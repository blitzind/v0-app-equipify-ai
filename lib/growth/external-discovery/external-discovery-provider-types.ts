/** Growth Engine — External discovery provider contracts (Prompt 26). */

import type {
  GrowthExternalDiscoveryAttribution,
  GrowthExternalDiscoveryEvidence,
} from "@/lib/growth/external-discovery/external-discovery-types"

export const GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES = [
  "google_places",
  "serp",
  "manual_import",
  "future_apollo",
  "future_seamless",
  "future_clay",
  "future_people_data_labs",
] as const

export type GrowthExternalDiscoveryProviderType =
  (typeof GROWTH_EXTERNAL_DISCOVERY_PROVIDER_TYPES)[number]

export const GROWTH_EXTERNAL_DISCOVERY_ACTIVE_PROVIDER_TYPES = [
  "manual_import",
] as const

export type GrowthExternalDiscoveryQuery = {
  query: string
  industry: string | null
  location: string | null
  limit?: number
}

export type GrowthExternalDiscoveryProviderRawCandidate = {
  company_name: string
  website?: string | null
  domain?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  category?: string | null
  industry?: string | null
  location?: string | null
  rating?: number | null
  review_count?: number | null
  source_url?: string | null
  confidence?: number | null
  evidence: GrowthExternalDiscoveryEvidence[]
  source_attribution: GrowthExternalDiscoveryAttribution[]
  /** Server-side only — never sent to client. */
  raw_payload?: Record<string, unknown>
}

export type GrowthExternalDiscoveryProviderResult = {
  provider_name: string
  provider_type: GrowthExternalDiscoveryProviderType
  status: "success" | "skipped" | "failed"
  message: string
  candidates: GrowthExternalDiscoveryProviderRawCandidate[]
  error?: string | null
}

export type GrowthExternalDiscoveryProvider = {
  provider_name: string
  provider_type: GrowthExternalDiscoveryProviderType
  isConfigured: () => boolean
  discover: (input: GrowthExternalDiscoveryQuery) => Promise<GrowthExternalDiscoveryProviderResult>
}
