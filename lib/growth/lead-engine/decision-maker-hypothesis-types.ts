/** Lead Engine slice — Decision Maker Hypothesis Engine types (Prompt 3). Client-safe. */

import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"

export const GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_QA_MARKER =
  "lead-engine-decision-maker-hypothesis-v1" as const

export const GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS = [
  "owner_patterns",
  "operations_patterns",
  "service_patterns",
  "executive_patterns",
  "procurement_patterns",
  "technical_patterns",
] as const

export type GrowthLeadEngineDecisionMakerRolePatternKey =
  (typeof GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS)[number]

/** Upstream Lead Engine outputs only — no contact records. */
export type GrowthLeadEngineDecisionMakerHypothesisInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
}

export type GrowthLeadEngineDecisionMakerTargetingStrategy = {
  primary_motion: string
  reason: string
}

export type GrowthLeadEngineDecisionMakerRoleHypothesis = {
  role: string
  confidence: number
  reason: string
}

export type GrowthLeadEngineDecisionMakerAvoidRole = {
  role: string
  reason: string
}

export type GrowthLeadEngineDecisionMakerBuyingCommittee = {
  primary_targets: GrowthLeadEngineDecisionMakerRoleHypothesis[]
  secondary_targets: GrowthLeadEngineDecisionMakerRoleHypothesis[]
  avoid_roles: GrowthLeadEngineDecisionMakerAvoidRole[]
}

export type GrowthLeadEngineDecisionMakerRolePatterns = Record<
  GrowthLeadEngineDecisionMakerRolePatternKey,
  string[]
>

export type GrowthLeadEngineDecisionMakerCommitteeCompleteness = {
  recommended_contacts: number
  minimum_contacts: number
  critical_missing_roles: string[]
}

export type GrowthLeadEngineDecisionMakerConfidenceAssessment = {
  score: number
  reasoning: string[]
}

/** Role hypotheses and confidence only — no invented people or outreach. */
export type GrowthLeadEngineDecisionMakerHypothesisOutput = {
  recommended_targeting_strategy: GrowthLeadEngineDecisionMakerTargetingStrategy
  buying_committee: GrowthLeadEngineDecisionMakerBuyingCommittee
  role_patterns: GrowthLeadEngineDecisionMakerRolePatterns
  committee_completeness: GrowthLeadEngineDecisionMakerCommitteeCompleteness
  escalation_path: string[]
  engagement_priority: string[]
  confidence_assessment: GrowthLeadEngineDecisionMakerConfidenceAssessment
}

export const GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_OUTPUT_JSON_KEYS = [
  "recommended_targeting_strategy",
  "buying_committee",
  "role_patterns",
  "committee_completeness",
  "escalation_path",
  "engagement_priority",
  "confidence_assessment",
] as const
