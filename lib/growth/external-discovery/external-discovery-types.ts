/** Growth Engine — External Company Discovery types (Prompt 26). Client-safe. */

export const GROWTH_EXTERNAL_COMPANY_DISCOVERY_QA_MARKER =
  "growth-external-company-discovery-v1" as const

export const GROWTH_EXTERNAL_DISCOVERY_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "partial",
  "failed",
] as const

export type GrowthExternalDiscoveryRunStatus =
  (typeof GROWTH_EXTERNAL_DISCOVERY_RUN_STATUSES)[number]

export type GrowthExternalDiscoveryAttribution = {
  source: string
  provider_type: string
  provider_name: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthExternalDiscoveryEvidence = {
  claim: string
  evidence: string
  source: string
}

/** Operator-visible candidate — no raw_payload. */
export type GrowthExternalCompanyCandidate = {
  id: string
  created_at: string
  updated_at: string
  run_id: string
  provider_name: string
  provider_type: string
  query: string
  industry: string | null
  location: string | null
  company_name: string
  website: string | null
  domain: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  category: string | null
  rating: number | null
  review_count: number | null
  source_url: string | null
  confidence: number
  dedupe_hash: string
  existing_customer_match: boolean
  existing_prospect_match: boolean
  existing_growth_lead_match: boolean
  evidence: GrowthExternalDiscoveryEvidence[]
  source_attribution: GrowthExternalDiscoveryAttribution[]
  metadata: Record<string, unknown>
}

export type GrowthExternalCompanyDiscoveryRun = {
  id: string
  created_at: string
  updated_at: string
  created_by: string | null
  query: string
  industry: string | null
  location: string | null
  provider_names: string[]
  status: GrowthExternalDiscoveryRunStatus
  candidate_count: number
  error_message: string | null
  metadata: Record<string, unknown>
}

export const GROWTH_EXTERNAL_DISCOVERY_PRIVACY_NOTE =
  "External discovery candidates are not leads until an operator pushes to Lead Inbox. No fabricated data, no email guessing, no person enrichment, and no autonomous outreach."
