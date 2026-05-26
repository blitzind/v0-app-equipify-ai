/** Lead Engine slice — Verification Triage Engine types (Prompt 5). Client-safe. */

import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"

export const GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_QA_MARKER =
  "lead-engine-verification-triage-v1" as const

export const GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS = [
  "validated",
  "risky",
  "reject",
] as const

export type GrowthLeadEngineVerificationDisposition =
  (typeof GROWTH_LEAD_ENGINE_VERIFICATION_DISPOSITIONS)[number]

export const GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES = [
  "EMAIL_CONFIRMED",
  "EMAIL_FORMAT_INVALID",
  "EMAIL_CATCH_ALL",
  "EMAIL_ROLE_BASED",
  "EMAIL_NOT_FOUND",
  "PHONE_CONFIRMED",
  "PHONE_UNVERIFIED",
  "PHONE_DISCONNECTED",
  "LINKEDIN_CONFIRMED",
  "CONTACT_INCOMPLETE",
  "LOW_EVIDENCE",
  "MULTIPLE_CONFLICTING_SIGNALS",
  "COMPANY_MISMATCH",
  "DUPLICATE_POSSIBLE",
  "HIGH_RISK_CONTACT",
  "STALE_SIGNAL",
] as const

export type GrowthLeadEngineVerificationReasonCode =
  (typeof GROWTH_LEAD_ENGINE_VERIFICATION_REASON_CODES)[number]

export const GROWTH_LEAD_ENGINE_VERIFICATION_REJECT_REASON_CODES = [
  "COMPANY_MISMATCH",
  "EMAIL_FORMAT_INVALID",
  "PHONE_DISCONNECTED",
  "MULTIPLE_CONFLICTING_SIGNALS",
] as const

export const GROWTH_LEAD_ENGINE_VERIFICATION_POSITIVE_REASON_CODES = [
  "EMAIL_CONFIRMED",
  "PHONE_CONFIRMED",
  "LINKEDIN_CONFIRMED",
] as const

/** Upstream Lead Engine outputs only — no live verification providers. */
export type GrowthLeadEngineVerificationTriageInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
}

export type GrowthLeadEngineChannelVerificationSignals = {
  status: string
  confidence: number
  reason_codes: GrowthLeadEngineVerificationReasonCode[]
  evidence: string
  sources: string[]
}

export type GrowthLeadEngineVerificationSourceAttribution = {
  source: string
  channel: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineDuplicateDetectionReadiness = {
  ready: boolean
  reason: string
  missing_inputs: string[]
}

export type GrowthLeadEngineDuplicateHashInputs = {
  company_name: string
  domain: string
  contact_email: string
  contact_phone: string
  full_name: string
  normalized_key: string
}

/** Deterministic verification triage from upstream evidence only. */
export type GrowthLeadEngineVerificationTriageOutput = {
  disposition: GrowthLeadEngineVerificationDisposition
  verification_confidence: number
  verification_reason_codes: GrowthLeadEngineVerificationReasonCode[]
  email_verification_signals: GrowthLeadEngineChannelVerificationSignals
  phone_verification_signals: GrowthLeadEngineChannelVerificationSignals
  linkedin_verification_signals: GrowthLeadEngineChannelVerificationSignals
  contact_completeness: number
  risk_score: number
  duplicate_detection_readiness: GrowthLeadEngineDuplicateDetectionReadiness
  duplicate_hash_inputs: GrowthLeadEngineDuplicateHashInputs
  verification_source_attribution: GrowthLeadEngineVerificationSourceAttribution[]
  human_review_required: boolean
}

export const GROWTH_LEAD_ENGINE_VERIFICATION_TRIAGE_OUTPUT_JSON_KEYS = [
  "disposition",
  "verification_confidence",
  "verification_reason_codes",
  "email_verification_signals",
  "phone_verification_signals",
  "linkedin_verification_signals",
  "contact_completeness",
  "risk_score",
  "duplicate_detection_readiness",
  "duplicate_hash_inputs",
  "verification_source_attribution",
  "human_review_required",
] as const
