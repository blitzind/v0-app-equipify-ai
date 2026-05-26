/** Lead Engine slice — Account Brief Engine types (Prompt 6). Client-safe. */

import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

export const GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_QA_MARKER = "lead-engine-account-brief-v1" as const

/** Upstream Lead Engine outputs only — no live enrichment or outreach. */
export type GrowthLeadEngineAccountBriefInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
}

export type GrowthLeadEngineAccountBriefSourceAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineEvidenceBackedClaim = {
  claim: string
  evidence: string
  source: string
  confidence: number
}

/** Evidence-backed account brief for human review and downstream outreach prep. */
export type GrowthLeadEngineAccountBriefOutput = {
  company_summary: string
  why_this_account: string
  fit_summary: string
  pain_points: GrowthLeadEngineEvidenceBackedClaim[]
  growth_signals: GrowthLeadEngineEvidenceBackedClaim[]
  buying_signals: GrowthLeadEngineEvidenceBackedClaim[]
  technology_summary: string
  buying_committee_summary: string
  verified_contacts_summary: string
  risk_summary: string
  competitive_context: GrowthLeadEngineEvidenceBackedClaim[]
  recommended_angle: string
  recommended_value_props: string[]
  recommended_cta: string
  research_confidence: number
  brief_completeness: number
  human_review_required: boolean
  evidence_summary: string
  source_attribution: GrowthLeadEngineAccountBriefSourceAttribution[]
}

export const GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_OUTPUT_JSON_KEYS = [
  "company_summary",
  "why_this_account",
  "fit_summary",
  "pain_points",
  "growth_signals",
  "buying_signals",
  "technology_summary",
  "buying_committee_summary",
  "verified_contacts_summary",
  "risk_summary",
  "competitive_context",
  "recommended_angle",
  "recommended_value_props",
  "recommended_cta",
  "research_confidence",
  "brief_completeness",
  "human_review_required",
  "evidence_summary",
  "source_attribution",
] as const
