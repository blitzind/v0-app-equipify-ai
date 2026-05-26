/** Lead Engine slice — Outreach Personalization Engine types (Prompt 7). Client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

export const GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_QA_MARKER =
  "lead-engine-outreach-personalization-v1" as const

export const GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES = [
  "EMAIL",
  "PHONE",
  "LINKEDIN",
  "MULTI_TOUCH",
] as const

export type GrowthLeadEngineOutreachChannelPriority =
  (typeof GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES)[number]

export const GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES = [
  "CONTACT_FIRST",
  "COMPANY_CONTEXT_FIRST",
  "EMAIL_BEFORE_PHONE",
  "PHONE_AFTER_VALIDATION",
  "MULTI_TOUCH_PARALLEL",
  "LINKEDIN_AFTER_EMAIL",
] as const

export type GrowthLeadEngineOutreachSequencePriority =
  (typeof GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES)[number]

export const GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES = [
  "INDUSTRY_PEER",
  "SIMILAR_COMPANY_SIZE",
  "GEOGRAPHIC_PEER",
  "USE_CASE_MATCH",
  "OUTCOME_METRIC_MATCH",
  "VERTICAL_EXPERTISE",
] as const

export type GrowthLeadEngineOutreachSocialProofType =
  (typeof GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES)[number]

export const GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES = [
  "DISPATCH_OPTIMIZATION",
  "FIELD_SERVICE_EFFICIENCY",
  "OPERATIONS_VISIBILITY",
  "TECHNICIAN_UTILIZATION",
  "MULTI_SITE_COORDINATION",
  "COMPLIANCE_WORKFLOW",
] as const

export type GrowthLeadEngineOutreachCaseStudyType =
  (typeof GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES)[number]

export const GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES = [
  "DISCOVERY_VALIDATION",
  "FIT_CONFIRMATION",
  "PAIN_VALIDATION",
  "COMMITTEE_MAPPING",
  "TIMING_CHECK",
  "CHANNEL_TEST",
] as const

export type GrowthLeadEngineOutreachCtaStrategyCategory =
  (typeof GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES)[number]

/** Upstream Lead Engine outputs only — no message generation or providers. */
export type GrowthLeadEngineOutreachPersonalizationInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief: GrowthLeadEngineAccountBriefOutput | string
}

export type GrowthLeadEngineOutreachPersonalizationSourceAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineOutreachEvidenceBackedItem = {
  claim: string
  evidence: string
  source: string
  confidence: number
}

/** Personalization guidance for human reps — categories and strategy only, no copy. */
export type GrowthLeadEngineOutreachPersonalizationOutput = {
  personalization_summary: string
  contact_context: string
  company_context: string
  recommended_talking_points: GrowthLeadEngineOutreachEvidenceBackedItem[]
  recommended_problem_alignment: GrowthLeadEngineOutreachEvidenceBackedItem[]
  recommended_business_outcomes: string[]
  recommended_social_proof_types: GrowthLeadEngineOutreachSocialProofType[]
  recommended_case_study_types: GrowthLeadEngineOutreachCaseStudyType[]
  recommended_objection_categories: GrowthLeadEngineOutreachEvidenceBackedItem[]
  recommended_cta_strategy: string
  urgency_signals: GrowthLeadEngineOutreachEvidenceBackedItem[]
  timing_signals: GrowthLeadEngineOutreachEvidenceBackedItem[]
  recommended_channel_priority: GrowthLeadEngineOutreachChannelPriority[]
  recommended_sequence_priority: GrowthLeadEngineOutreachSequencePriority
  personalization_confidence: number
  personalization_completeness: number
  human_review_required: boolean
  evidence_summary: string
  source_attribution: GrowthLeadEngineOutreachPersonalizationSourceAttribution[]
}

export const GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_OUTPUT_JSON_KEYS = [
  "personalization_summary",
  "contact_context",
  "company_context",
  "recommended_talking_points",
  "recommended_problem_alignment",
  "recommended_business_outcomes",
  "recommended_social_proof_types",
  "recommended_case_study_types",
  "recommended_objection_categories",
  "recommended_cta_strategy",
  "urgency_signals",
  "timing_signals",
  "recommended_channel_priority",
  "recommended_sequence_priority",
  "personalization_confidence",
  "personalization_completeness",
  "human_review_required",
  "evidence_summary",
  "source_attribution",
] as const
