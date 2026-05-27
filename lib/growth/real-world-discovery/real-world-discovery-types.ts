/** Growth Engine — Real-World Company Discovery (Prompt 29). Client-safe. */

export const GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER =
  "growth-real-world-company-discovery-v1" as const

export const GROWTH_REAL_WORLD_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthRealWorldDiscoveryRunStatus =
  (typeof GROWTH_REAL_WORLD_DISCOVERY_RUN_STATUSES)[number]

export const GROWTH_REAL_WORLD_PROVIDER_STATUS_LABELS = [
  "live_provider_active",
  "fixture_fallback_active",
  "no_provider_configured",
] as const

export type GrowthRealWorldProviderStatusLabel =
  (typeof GROWTH_REAL_WORLD_PROVIDER_STATUS_LABELS)[number]

export const GROWTH_REAL_WORLD_SOURCE_BADGE_LABELS: Record<string, string> = {
  google_places: "Google Places",
  serp: "SERP",
  business_directory: "Business directory",
  manual_import: "Manual import",
  fixture: "Fixture",
}

export type GrowthRealWorldDiscoveryAttribution = {
  source: string
  provider_type: string
  provider_name: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthRealWorldDiscoveryEvidence = {
  claim: string
  evidence: string
  source: string
}

/** Operator-visible candidate — no raw_payload_server_only. */
export type GrowthRealWorldCompanyCandidate = {
  id: string
  created_at: string
  updated_at: string
  run_id: string
  query: string
  industry: string | null
  location: string | null
  provider_name: string
  provider_type: string
  company_name: string
  website: string | null
  domain: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  category: string | null
  description: string | null
  rating: number | null
  review_count: number | null
  source_url: string | null
  source_rank: number | null
  confidence: number
  dedupe_hash: string
  existing_customer_match: boolean
  existing_prospect_match: boolean
  existing_growth_lead_match: boolean
  evidence: GrowthRealWorldDiscoveryEvidence[]
  source_attribution: GrowthRealWorldDiscoveryAttribution[]
  metadata: Record<string, unknown>
}

export type GrowthRealWorldCompanyDiscoveryRun = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  query: string
  industry: string | null
  location: string | null
  provider_names: string[]
  status: GrowthRealWorldDiscoveryRunStatus
  candidate_count: number
  error_message: string | null
  metadata: Record<string, unknown>
}

export type GrowthRealWorldProviderStatusSummary = {
  label: GrowthRealWorldProviderStatusLabel
  message: string
  live_providers: string[]
  fixture_active: boolean
  provider_diagnostics?: GrowthRealWorldProviderExecutionDiagnostic[]
  provider_fallback_reason?: string | null
}

export type GrowthRealWorldProviderExecutionDiagnostic = {
  provider_type: string
  provider_name: string
  provider_executed: boolean
  provider_latency_ms: number
  provider_result_count: number
  provider_fallback_reason?: string | null
  provider_query_generated?: string[]
  provider_query_result_count?: number[]
  provider_merged_result_count?: number
  provider_cache_hit?: boolean
  provider_cache_age_ms?: number | null
  provider_cost_estimate?: number
  provider_live_request_count?: number
  provider_cache_hit_count?: number
}

export const GROWTH_REAL_WORLD_DISCOVERY_PRIVACY_NOTE =
  "Real-world discovery uses public business sources only — no Apollo, Seamless, Clay, or People Data Labs. Candidates require evidence and attribution. No fabricated companies, no guessed contacts, no autonomous outreach."
