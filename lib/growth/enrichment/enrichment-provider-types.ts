/** Growth Engine — Verification + enrichment provider contracts (Prompt 28). */

import type {
  GrowthEnrichmentAttribution,
  GrowthEnrichmentEvidence,
  GrowthVerificationChannelStatus,
} from "@/lib/growth/enrichment/enrichment-types"

export const GROWTH_ENRICHMENT_PROVIDER_TYPES = [
  "internal_growth",
  "manual_fixture",
  "future_hunter",
  "future_people_data_labs",
  "future_clearbit",
  "future_clay",
  "future_provider",
] as const

export type GrowthEnrichmentProviderType =
  (typeof GROWTH_ENRICHMENT_PROVIDER_TYPES)[number]

export type GrowthEnrichmentProviderQuery = {
  contact_candidate_id: string | null
  company_candidate_id: string | null
  company_name: string | null
  domain: string | null
  growth_lead_id: string | null
  contact_full_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_linkedin: string | null
}

export type GrowthContactVerificationProviderResult = {
  contact_candidate_id: string
  email_status: GrowthVerificationChannelStatus
  phone_status: GrowthVerificationChannelStatus
  linkedin_status: GrowthVerificationChannelStatus
  verification_confidence: number
  verification_reason: string
  evidence: GrowthEnrichmentEvidence[]
  source_attribution: GrowthEnrichmentAttribution[]
  /** Server-side only */
  raw_payload?: Record<string, unknown>
}

export type GrowthCompanyEnrichmentProviderResult = {
  company_candidate_id: string
  employee_estimate: string | null
  revenue_estimate: string | null
  industry: string | null
  subindustry: string | null
  technology_signals: string[]
  crm_signals: string[]
  service_signals: string[]
  location_signals: string[]
  confidence: number
  evidence: GrowthEnrichmentEvidence[]
  source_attribution: GrowthEnrichmentAttribution[]
  raw_payload?: Record<string, unknown>
}

export type GrowthEnrichmentProviderResult = {
  provider_name: string
  provider_type: GrowthEnrichmentProviderType
  status: "success" | "skipped" | "failed"
  message: string
  contact_verifications: GrowthContactVerificationProviderResult[]
  company_enrichments: GrowthCompanyEnrichmentProviderResult[]
  error?: string | null
}

export type GrowthEnrichmentProvider = {
  provider_name: string
  provider_type: GrowthEnrichmentProviderType
  isConfigured: () => boolean
  enrich: (input: GrowthEnrichmentProviderQuery) => Promise<GrowthEnrichmentProviderResult>
}
