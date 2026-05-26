/** Lead Engine slice — Company Discovery Engine types (Prompt 2). Client-safe. */

import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"

export const GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_QA_MARKER = "lead-engine-company-discovery-v1" as const

export const GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS = ["low", "medium", "high", "ideal"] as const
export type GrowthLeadEngineCompanyFitTier = (typeof GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS)[number]

/** Evidence-backed candidate inputs — no invented enrichment. */
export type GrowthLeadEngineCompanyDiscoveryInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  candidateSource: string
  companyName: string
  domain: string
  websiteText: string
  searchSnippets: string
  knownMetadata: string
}

export type GrowthLeadEngineCompanyProfile = {
  company_name: string
  domain: string
  industry: string
  sub_industry: string
  business_model: string
  service_area: string[]
  headquarters: string
  employee_estimate: string | null
  revenue_estimate: string | null
  phone: string
  address: string
  social_links: string[]
}

export type GrowthLeadEngineCompanyFitAssessment = {
  fit_score: number
  fit_tier: GrowthLeadEngineCompanyFitTier
  confidence: number
  matched_icp_rules: string[]
  missing_evidence: string[]
  disqualifiers: string[]
}

export type GrowthLeadEngineCompanyDiscoverySignals = {
  positive_fit_signals: string[]
  negative_fit_signals: string[]
  pain_signals: string[]
  buying_triggers: string[]
  technology_signals: string[]
  growth_signals: string[]
}

export type GrowthLeadEngineCompanySourceEvidence = {
  claim: string
  evidence: string
  source: string
}

export type GrowthLeadEngineCompanyRecommendedNextStep = {
  action: string
  reason: string
}

/** Normalized company profile + fit assessment from supplied evidence only. */
export type GrowthLeadEngineCompanyDiscoveryOutput = {
  company_profile: GrowthLeadEngineCompanyProfile
  fit_assessment: GrowthLeadEngineCompanyFitAssessment
  signals: GrowthLeadEngineCompanyDiscoverySignals
  recommended_next_step: GrowthLeadEngineCompanyRecommendedNextStep
  source_evidence: GrowthLeadEngineCompanySourceEvidence[]
}

export const GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_OUTPUT_JSON_KEYS = [
  "company_profile",
  "fit_assessment",
  "signals",
  "recommended_next_step",
  "source_evidence",
] as const
