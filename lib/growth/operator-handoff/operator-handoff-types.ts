/** Growth Engine — Operator Handoff Engine types (Prompt 17). Client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineRevenueExecutionOutput } from "@/lib/growth/lead-engine/revenue-execution-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"

export const GROWTH_OPERATOR_HANDOFF_QA_MARKER = "growth-operator-handoff-v1" as const

export const GROWTH_OPERATOR_HANDOFF_MOTIONS = [
  "call_first",
  "email_first",
  "linkedin_first",
  "research_more",
  "verify_contact",
  "enrich",
  "review",
  "disqualify",
] as const

export type GrowthOperatorHandoffMotion = (typeof GROWTH_OPERATOR_HANDOFF_MOTIONS)[number]

export const GROWTH_OPERATOR_HANDOFF_OWNERS = [
  "founder",
  "sales",
  "sdr",
  "account_executive",
  "marketing",
  "partner",
] as const

export type GrowthOperatorHandoffOwner = (typeof GROWTH_OPERATOR_HANDOFF_OWNERS)[number]

export const GROWTH_OPERATOR_HANDOFF_URGENCIES = [
  "immediate",
  "today",
  "this_week",
  "monitor",
] as const

export type GrowthOperatorHandoffUrgency = (typeof GROWTH_OPERATOR_HANDOFF_URGENCIES)[number]

export const GROWTH_OPERATOR_HANDOFF_CHANNELS = [
  "PHONE",
  "EMAIL",
  "LINKEDIN",
  "NONE",
] as const

export type GrowthOperatorHandoffChannel = (typeof GROWTH_OPERATOR_HANDOFF_CHANNELS)[number]

export const GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES = [
  "high",
  "medium",
  "low",
  "monitor",
] as const

export type GrowthOperatorHandoffLeadPriority =
  (typeof GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES)[number]

export type GrowthOperatorHandoffEvidenceItem = {
  claim: string
  evidence: string
  source: string
  confidence: number
}

export type GrowthOperatorHandoffAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

/** Upstream Lead Engine + inbox + intent — no outbound execution. */
export type GrowthOperatorHandoffInput = {
  leadInbox?: GrowthLeadInboxRow | null
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization: GrowthLeadEngineOutreachPersonalizationOutput | string
  leadScore: GrowthLeadEngineLeadScoreOutput | string
  humanApproval: GrowthLeadEngineHumanApprovalOutput | string
  revenueExecution: GrowthLeadEngineRevenueExecutionOutput | string
  intentHistory?: GrowthIntentPixelVisitHistory | string | null
}

export type GrowthOperatorHandoffOutput = {
  handoff_summary: string
  why_this_matters: string
  lead_priority: GrowthOperatorHandoffLeadPriority
  recommended_motion: GrowthOperatorHandoffMotion
  recommended_owner: GrowthOperatorHandoffOwner
  recommended_channel: GrowthOperatorHandoffChannel
  recommended_urgency: GrowthOperatorHandoffUrgency
  recommended_next_action: string
  objection_preparation: GrowthOperatorHandoffEvidenceItem[]
  missing_information: GrowthOperatorHandoffEvidenceItem[]
  human_notes: string[]
  recommended_followup_window: string
  talking_point_summary: string
  operator_confidence: number
  operator_confidence_reasoning: string
  operator_evidence: GrowthOperatorHandoffEvidenceItem[]
  operator_attribution: GrowthOperatorHandoffAttribution[]
  human_review_required: boolean
}

export const GROWTH_OPERATOR_HANDOFF_OUTPUT_JSON_KEYS = [
  "handoff_summary",
  "why_this_matters",
  "lead_priority",
  "recommended_motion",
  "recommended_owner",
  "recommended_channel",
  "recommended_urgency",
  "recommended_next_action",
  "objection_preparation",
  "missing_information",
  "human_notes",
  "recommended_followup_window",
  "talking_point_summary",
  "operator_confidence",
  "operator_confidence_reasoning",
  "operator_evidence",
  "operator_attribution",
  "human_review_required",
] as const

export type GrowthOperatorHandoffPackage = {
  qa_marker: typeof GROWTH_OPERATOR_HANDOFF_QA_MARKER
  lead_inbox_id: string | null
  generated_at: string
  handoff: GrowthOperatorHandoffOutput
}
