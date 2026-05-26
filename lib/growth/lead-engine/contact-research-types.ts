/** Lead Engine slice — Contact Research Engine types (Prompt 4). Client-safe. */

import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"

export const GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_QA_MARKER = "lead-engine-contact-research-v1" as const

export const GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_CONFIDENCE_TIERS = {
  direct: 1.0,
  corroborated: 0.7,
  weak: 0.4,
  unsupported: 0.0,
} as const

/** Evidence-backed research inputs — no invented enrichment. */
export type GrowthLeadEngineContactResearchInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  domain: string
  websiteText: string
  publicData: string
}

export type GrowthLeadEngineContactSourceEvidence = {
  claim: string
  evidence: string
  source: string
}

export type GrowthLeadEngineContactCandidate = {
  full_name: string
  job_title: string
  department: string
  role_match_type: string
  email: string
  email_confidence: number
  phone: string
  phone_confidence: number
  linkedin_url: string
  source_evidence: GrowthLeadEngineContactSourceEvidence[]
  confidence: number
}

export type GrowthLeadEngineContactResearchCoverage = {
  primary_roles_found: string[]
  missing_roles: string[]
  committee_completion: number
}

export type GrowthLeadEngineContactResearchQuality = {
  score: number
  reasoning: string[]
}

/** Candidate contacts supported by supplied evidence only. */
export type GrowthLeadEngineContactResearchOutput = {
  contact_candidates: GrowthLeadEngineContactCandidate[]
  coverage: GrowthLeadEngineContactResearchCoverage
  research_quality: GrowthLeadEngineContactResearchQuality
}

export const GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_OUTPUT_JSON_KEYS = [
  "contact_candidates",
  "coverage",
  "research_quality",
] as const
