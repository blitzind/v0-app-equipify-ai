/** Lead Engine slice — Lead Score Engine types (Prompt 8). Client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

export const GROWTH_LEAD_ENGINE_LEAD_SCORE_QA_MARKER = "lead-engine-lead-score-v1" as const

/** Transparent component weights (sum = 100). */
export const GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS = {
  fit_score: 25,
  intent_score: 20,
  contactability_score: 15,
  verification_score: 15,
  account_quality_score: 15,
  personalization_score: 10,
} as const

export const GROWTH_LEAD_ENGINE_LEAD_GRADES = ["A", "B", "C", "D", "F"] as const

export type GrowthLeadEngineLeadGrade = (typeof GROWTH_LEAD_ENGINE_LEAD_GRADES)[number]

export const GROWTH_LEAD_ENGINE_LEAD_PRIORITY_LEVELS = [
  "high",
  "medium",
  "low",
  "disqualified",
] as const

export type GrowthLeadEngineLeadPriorityLevel =
  (typeof GROWTH_LEAD_ENGINE_LEAD_PRIORITY_LEVELS)[number]

export const GROWTH_LEAD_ENGINE_LEAD_NEXT_ACTIONS = [
  "approve_for_human_review",
  "enrich_more",
  "verify_contact",
  "deprioritize",
  "disqualify",
] as const

export type GrowthLeadEngineLeadNextAction =
  (typeof GROWTH_LEAD_ENGINE_LEAD_NEXT_ACTIONS)[number]

/** Upstream Lead Engine outputs only — no providers or autonomous approval. */
export type GrowthLeadEngineLeadScoreInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization: GrowthLeadEngineOutreachPersonalizationOutput | string
}

export type GrowthLeadEngineLeadScoreSourceAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineLeadScoreComponentContribution = {
  component: keyof typeof GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS
  score: number
  weight: number
  contribution: number
}

export type GrowthLeadEngineLeadScoreRiskPenalty = {
  code: string
  penalty: number
  evidence: string
}

export type GrowthLeadEngineLeadScoreBreakdown = {
  components: GrowthLeadEngineLeadScoreComponentContribution[]
  raw_weighted_score: number
  risk_penalties: GrowthLeadEngineLeadScoreRiskPenalty[]
  total_risk_penalty: number
  computed_lead_score: number
}

/** Deterministic lead score package for routing and human review. */
export type GrowthLeadEngineLeadScoreOutput = {
  lead_score: number
  lead_grade: GrowthLeadEngineLeadGrade
  fit_score: number
  intent_score: number
  contactability_score: number
  verification_score: number
  account_quality_score: number
  personalization_score: number
  risk_score: number
  priority_level: GrowthLeadEngineLeadPriorityLevel
  recommended_next_action: GrowthLeadEngineLeadNextAction
  disqualification_reasons: string[]
  score_breakdown: GrowthLeadEngineLeadScoreBreakdown
  score_explanation: string
  human_review_required: boolean
  source_attribution: GrowthLeadEngineLeadScoreSourceAttribution[]
}

export const GROWTH_LEAD_ENGINE_LEAD_SCORE_OUTPUT_JSON_KEYS = [
  "lead_score",
  "lead_grade",
  "fit_score",
  "intent_score",
  "contactability_score",
  "verification_score",
  "account_quality_score",
  "personalization_score",
  "risk_score",
  "priority_level",
  "recommended_next_action",
  "disqualification_reasons",
  "score_breakdown",
  "score_explanation",
  "human_review_required",
  "source_attribution",
] as const
