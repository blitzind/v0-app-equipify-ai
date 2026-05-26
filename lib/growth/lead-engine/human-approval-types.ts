/** Lead Engine slice — Human Approval Engine types (Prompt 9). Client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

export const GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_QA_MARKER = "lead-engine-human-approval-v1" as const

export const GROWTH_LEAD_ENGINE_APPROVAL_STATUSES = [
  "approved",
  "conditional",
  "blocked",
] as const

export type GrowthLeadEngineApprovalStatus =
  (typeof GROWTH_LEAD_ENGINE_APPROVAL_STATUSES)[number]

export const GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES = ["urgent", "normal", "low"] as const

export type GrowthLeadEngineApprovalPriority =
  (typeof GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES)[number]

export const GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES = [
  "LEAD_SCORE_STRONG",
  "LEAD_SCORE_WEAK",
  "VERIFICATION_VALIDATED",
  "VERIFICATION_RISKY",
  "VERIFICATION_REJECTED",
  "ATTRIBUTION_INSUFFICIENT",
  "EVIDENCE_INCOMPLETE",
  "HUMAN_REVIEW_FLAGGED",
  "HIGH_RISK",
  "DUPLICATE_RISK",
  "COMPANY_MISMATCH",
  "ENRICHMENT_NEEDED",
  "DISQUALIFICATION_ACTIVE",
  "READY_FOR_HUMAN_APPROVAL",
  "BLOCKED_BY_POLICY",
] as const

export type GrowthLeadEngineApprovalReasonCode =
  (typeof GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES)[number]

export const GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS = [
  "verification",
  "attribution",
  "scoring",
  "contact_quality",
  "account_brief",
  "personalization",
  "risk",
  "duplicate_review",
] as const

export type GrowthLeadEngineRequiredReviewArea =
  (typeof GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS)[number]

export const GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS = [
  "approve",
  "enrich",
  "verify_contact",
  "request_review",
  "deprioritize",
  "disqualify",
] as const

export type GrowthLeadEngineRecommendedHumanAction =
  (typeof GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS)[number]

/** Upstream Lead Engine outputs only — no autonomous approval or outbound execution. */
export type GrowthLeadEngineHumanApprovalInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization: GrowthLeadEngineOutreachPersonalizationOutput | string
  leadScore: GrowthLeadEngineLeadScoreOutput | string
}

export type GrowthLeadEngineHumanApprovalSourceAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineApprovalBlocker = {
  code: string
  evidence: string
  source: string
  confidence: number
}

/** Human approval routing package — recommends review, never auto-executes outreach. */
export type GrowthLeadEngineHumanApprovalOutput = {
  approval_status: GrowthLeadEngineApprovalStatus
  approval_reason_codes: GrowthLeadEngineApprovalReasonCode[]
  approval_confidence: number
  approval_priority: GrowthLeadEngineApprovalPriority
  human_review_required: boolean
  required_review_areas: GrowthLeadEngineRequiredReviewArea[]
  recommended_human_actions: GrowthLeadEngineRecommendedHumanAction[]
  approval_blockers: GrowthLeadEngineApprovalBlocker[]
  approval_summary: string
  review_notes_required: boolean
  escalation_required: boolean
  escalation_reason: string
  evidence_summary: string
  source_attribution: GrowthLeadEngineHumanApprovalSourceAttribution[]
}

export const GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_OUTPUT_JSON_KEYS = [
  "approval_status",
  "approval_reason_codes",
  "approval_confidence",
  "approval_priority",
  "human_review_required",
  "required_review_areas",
  "recommended_human_actions",
  "approval_blockers",
  "approval_summary",
  "review_notes_required",
  "escalation_required",
  "escalation_reason",
  "evidence_summary",
  "source_attribution",
] as const
