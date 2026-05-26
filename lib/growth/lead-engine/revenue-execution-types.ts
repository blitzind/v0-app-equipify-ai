/** Lead Engine slice — Revenue Execution Engine types (Prompt 10). Client-safe. */

import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineCompanyDiscoveryOutput } from "@/lib/growth/lead-engine/company-discovery-types"
import type { GrowthLeadEngineContactResearchOutput } from "@/lib/growth/lead-engine/contact-research-types"
import type { GrowthLeadEngineDecisionMakerHypothesisOutput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import type { GrowthLeadEngineHumanApprovalOutput } from "@/lib/growth/lead-engine/human-approval-types"
import type { GrowthLeadEngineIcpTargetingOutput } from "@/lib/growth/lead-engine/icp-targeting-types"
import type { GrowthLeadEngineLeadScoreOutput } from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

export const GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_QA_MARKER =
  "lead-engine-revenue-execution-v1" as const

export const GROWTH_LEAD_ENGINE_EXECUTION_STATUSES = ["ready", "blocked", "waiting"] as const

export type GrowthLeadEngineExecutionStatus =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_STATUSES)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES = ["urgent", "normal", "low"] as const

export type GrowthLeadEngineExecutionPriority =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_PATHS = [
  "outbound_sales",
  "inbound_followup",
  "call_sequence",
  "multi_touch",
  "nurture",
  "partner_motion",
] as const

export type GrowthLeadEngineExecutionPath =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_PATHS)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS = [
  "EMAIL",
  "PHONE",
  "LINKEDIN",
  "SMS",
  "MULTI_TOUCH",
] as const

export type GrowthLeadEngineExecutionChannel =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES = [
  "sales",
  "founder",
  "account_executive",
  "sdr",
  "marketing",
  "partner",
] as const

export type GrowthLeadEngineExecutionOwnerType =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS = [
  "assign_owner",
  "enrich_first",
  "review_first",
  "disqualify",
] as const

export type GrowthLeadEngineExecutionHandoff =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS)[number]

export const GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES = [
  "immediate",
  "daily",
  "weekly",
  "monthly",
] as const

export type GrowthLeadEngineExecutionTouchFrequency =
  (typeof GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES)[number]

/** Upstream Lead Engine outputs only — no autonomous execution or message generation. */
export type GrowthLeadEngineRevenueExecutionInput = {
  icpTargeting: GrowthLeadEngineIcpTargetingOutput | string
  companyDiscovery: GrowthLeadEngineCompanyDiscoveryOutput | string
  decisionMakerHypothesis: GrowthLeadEngineDecisionMakerHypothesisOutput | string
  contactResearch: GrowthLeadEngineContactResearchOutput | string
  verificationTriage: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization: GrowthLeadEngineOutreachPersonalizationOutput | string
  leadScore: GrowthLeadEngineLeadScoreOutput | string
  humanApproval: GrowthLeadEngineHumanApprovalOutput | string
}

export type GrowthLeadEngineRevenueExecutionSourceAttribution = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadEngineExecutionEvidenceItem = {
  code: string
  evidence: string
  source: string
  confidence: number
}

export type GrowthLeadEngineExecutionSequenceStep = {
  step_order: number
  channel: GrowthLeadEngineExecutionChannel
  action_category: string
  evidence: string
}

/** Revenue execution routing — human-operated, never auto-sends outreach. */
export type GrowthLeadEngineRevenueExecutionOutput = {
  execution_status: GrowthLeadEngineExecutionStatus
  execution_readiness: number
  execution_priority: GrowthLeadEngineExecutionPriority
  recommended_execution_path: GrowthLeadEngineExecutionPath
  recommended_channels: GrowthLeadEngineExecutionChannel[]
  recommended_sequence: string
  recommended_sequence_steps: GrowthLeadEngineExecutionSequenceStep[]
  recommended_timing: string
  recommended_owner_type: GrowthLeadEngineExecutionOwnerType
  recommended_handoff: GrowthLeadEngineExecutionHandoff
  recommended_followup_strategy: string
  recommended_touch_frequency: GrowthLeadEngineExecutionTouchFrequency
  execution_blockers: GrowthLeadEngineExecutionEvidenceItem[]
  execution_dependencies: GrowthLeadEngineExecutionEvidenceItem[]
  execution_confidence: number
  human_execution_required: boolean
  evidence_summary: string
  source_attribution: GrowthLeadEngineRevenueExecutionSourceAttribution[]
}

export const GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_OUTPUT_JSON_KEYS = [
  "execution_status",
  "execution_readiness",
  "execution_priority",
  "recommended_execution_path",
  "recommended_channels",
  "recommended_sequence",
  "recommended_sequence_steps",
  "recommended_timing",
  "recommended_owner_type",
  "recommended_handoff",
  "recommended_followup_strategy",
  "recommended_touch_frequency",
  "execution_blockers",
  "execution_dependencies",
  "execution_confidence",
  "human_execution_required",
  "evidence_summary",
  "source_attribution",
] as const
