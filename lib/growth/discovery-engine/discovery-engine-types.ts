/** Continuous discovery engine types. Client-safe. */

export const GROWTH_DISCOVERY_ENGINE_QA_MARKER = "growth-discovery-engine-v1" as const

export const GROWTH_DISCOVERY_SOURCE_TYPES = [
  "google_business",
  "website_discovery",
  "territory_expansion",
  "industry_expansion",
  "referral_graph",
  "related_company",
  "public_company_source",
  "manual_seed",
] as const
export type GrowthDiscoverySourceType = (typeof GROWTH_DISCOVERY_SOURCE_TYPES)[number]

export type GrowthDiscoveryRun = {
  id: string
  run_type: "continuous" | "segment" | "territory" | "manual"
  segment_key: string | null
  discovery_source_type: GrowthDiscoverySourceType
  query_text: string
  industry: string | null
  territory_id: string | null
  status: "pending" | "running" | "completed" | "partial" | "failed"
  new_companies_found: number
  duplicates_skipped: number
  high_fit_found: number
  territory_matches: number
  signal_matches: number
  error_message: string | null
  evidence: Array<{ claim: string; evidence: string; source: string }>
  metadata: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export type GrowthDiscoveryCandidate = {
  id: string
  run_id: string
  company_id: string
  source_type: string
  company_name: string
  website: string | null
  domain: string | null
  industry: string | null
  location: string | null
  city: string | null
  state: string | null
  discovery_source_type: GrowthDiscoverySourceType
  source_confidence: number
  evidence: Array<{ claim: string; evidence: string; source: string }>
  reason_discovered: string
  dedupe_hash: string
  is_suppressed: boolean
  is_duplicate: boolean
  high_fit: boolean
  territory_match: boolean
  signal_match: boolean
  discovered_at: string
}

export type GrowthDiscoverySegment = {
  key: string
  label: string
  query: string
  industry: string
  discovery_source_type: GrowthDiscoverySourceType
}

export const GROWTH_DISCOVERY_ENGINE_PRIVACY_NOTE =
  "Continuous discovery stores only provider-backed or indexed evidence. No fabricated companies or contacts."
