/** Growth Engine — Contact discovery provider contracts (Prompt 27). */

import type {
  GrowthContactDiscoveryAttribution,
  GrowthContactDiscoveryEvidence,
} from "@/lib/growth/contact-discovery/contact-discovery-types"

export const GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES = [
  "manual_fixture",
  "internal_growth",
  "future_apollo",
  "future_seamless",
  "future_people_data_labs",
  "future_clay",
  "future_provider",
] as const

export type GrowthContactDiscoveryProviderType =
  (typeof GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES)[number]

export type GrowthContactDiscoveryProviderQuery = {
  company_candidate_id: string
  company_name: string
  domain: string | null
  growth_lead_id: string | null
  industry: string | null
  limit?: number
}

export type GrowthContactDiscoveryProviderRawContact = {
  full_name: string
  first_name?: string | null
  last_name?: string | null
  job_title?: string | null
  department?: string | null
  seniority?: string | null
  linkedin_url?: string | null
  email?: string | null
  phone?: string | null
  /** When set, PII fields may be retained if they pass normalizer rules. */
  pii_observed?: boolean
  confidence?: number | null
  evidence: GrowthContactDiscoveryEvidence[]
  source_attribution: GrowthContactDiscoveryAttribution[]
  metadata?: Record<string, unknown>
}

export type GrowthContactDiscoveryProviderResult = {
  provider_name: string
  provider_type: GrowthContactDiscoveryProviderType
  status: "success" | "skipped" | "failed"
  message: string
  contacts: GrowthContactDiscoveryProviderRawContact[]
  error?: string | null
}

export type GrowthContactDiscoveryProvider = {
  provider_name: string
  provider_type: GrowthContactDiscoveryProviderType
  isConfigured: () => boolean
  discover: (
    input: GrowthContactDiscoveryProviderQuery,
  ) => Promise<GrowthContactDiscoveryProviderResult>
}
