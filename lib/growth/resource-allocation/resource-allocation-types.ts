/** SV1-1 / ARCH-1A — Resource Allocation Facade types (client-safe). */

import type { GrowthResearchSufficiencyDecisionKind } from "@/lib/growth/research/growth-research-sufficiency-1a"
import type { GrowthBoundedResearchAuthorization } from "@/lib/growth/revenue-workflow/growth-investment-propagation-1b"

export const AI_OS_RESOURCE_ALLOCATION_QA_MARKER = "sv1-1-resource-allocation-facade-v1" as const

export const AI_OS_RESOURCE_ALLOCATION_MODE = ["shadow", "enforce"] as const
export type AiOsResourceAllocationMode = (typeof AI_OS_RESOURCE_ALLOCATION_MODE)[number]

/** Production default until enforce parity is certified. */
export const AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE: AiOsResourceAllocationMode = "shadow"

export const AI_OS_INVESTMENT_STATES = [
  "increase_investment",
  "maintain_investment",
  "pending_investment",
  "reduce_investment",
  "stop_investment",
] as const

export type AiOsInvestmentState = (typeof AI_OS_INVESTMENT_STATES)[number]

export const AI_OS_SCARCE_RESOURCE_CLASSES = [
  "website_research",
  "datamoon_enrichment",
  "llm_generation",
  "email_drafting",
  "sequence_preparation",
  "voice_generation",
  "sms_generation",
  "browser_automation",
  "other_scarce",
] as const

export type AiOsScarceResourceClass = (typeof AI_OS_SCARCE_RESOURCE_CLASSES)[number]

export const AI_OS_RESOURCE_COST_TIERS = ["low_cost", "billable", "outbound"] as const
export type AiOsResourceCostTier = (typeof AI_OS_RESOURCE_COST_TIERS)[number]

export const AI_OS_RESOURCE_COST_TIER_BY_CLASS: Record<AiOsScarceResourceClass, AiOsResourceCostTier> = {
  website_research: "low_cost",
  datamoon_enrichment: "billable",
  llm_generation: "billable",
  email_drafting: "billable",
  sequence_preparation: "billable",
  voice_generation: "outbound",
  sms_generation: "outbound",
  browser_automation: "billable",
  other_scarce: "billable",
}

export type AiOsResourceAllocationAdmissionSignal = {
  state: "accepted" | "review" | "rejected" | "invalid" | "unknown"
  allowAutoResearch?: boolean | null
  requiresHumanReview?: boolean | null
}

export type AiOsResourceAllocationSupportingSignals = {
  admission?: AiOsResourceAllocationAdmissionSignal | null
  /** Existing qualification / opportunity recommendation strings — not re-scored here. */
  qualificationRecommendation?: string | null
  evidenceConfidence?: number | null
  researchFresh?: boolean | null
  researchStale?: boolean | null
  hasUsableResearch?: boolean | null
  autonomyAllowed?: boolean | null
  autonomyBlockedReason?: string | null
  budgetAvailable?: boolean | null
  budgetPressure?: boolean | null
  stopConditionActive?: boolean | null
  stopConditionReason?: string | null
  approvalRequired?: boolean | null
  approvalGranted?: boolean | null
  killSwitchActive?: boolean | null
  objectiveAligned?: boolean | null
  /** GE-AIOS-RESEARCH-SUFFICIENCY-1A — canonical package-ready projection input. */
  researchSufficientForPackage?: boolean | null
  /** GE-AIOS-RESEARCH-SUFFICIENCY-1A — send/transport readiness remains separately gated. */
  sendReady?: boolean | null
  /** GE-AIOS-INVESTMENT-PROPAGATION-1B — persisted canonical sufficiency decision. */
  researchSufficiencyDecision?: GrowthResearchSufficiencyDecisionKind | null
  /** GE-AIOS-INVESTMENT-PROPAGATION-1B — bounded targeted research authorization projection. */
  boundedResearchAuthorization?: GrowthBoundedResearchAuthorization | null
}

export type AiOsResourceAllocationRequest = {
  organizationId: string
  accountId: string
  accountKind?: "lead" | "company" | "campaign" | "other"
  resourceClass: AiOsScarceResourceClass
  requestedBy?: string | null
  mode?: AiOsResourceAllocationMode
  signals: AiOsResourceAllocationSupportingSignals
}

export type AiOsResourceAllocationDecision = {
  qaMarker: typeof AI_OS_RESOURCE_ALLOCATION_QA_MARKER
  investment_state: AiOsInvestmentState
  spend_authorized: boolean
  reason: string
  confidence: number
  blocking_conditions: string[]
  next_review: string | null
  supporting_signals: AiOsResourceAllocationSupportingSignals
  resource_class: AiOsScarceResourceClass
  cost_tier: AiOsResourceCostTier
  mode: AiOsResourceAllocationMode
  /** Shadow never changes production; enforce would apply spend_authorized. */
  enforcement_applied: false | true
  decided_at: string
}

export type AiOsResourceAllocationLedgerEntry = {
  qaMarker: typeof AI_OS_RESOURCE_ALLOCATION_QA_MARKER
  entryId: string
  organizationId: string
  accountId: string
  accountKind: string
  resourceRequested: AiOsScarceResourceClass
  resourceClass: AiOsScarceResourceClass
  estimatedResourceClass: AiOsResourceCostTier
  investmentState: AiOsInvestmentState
  decision: "authorize" | "deny"
  spendAuthorized: boolean
  reason: string
  mode: AiOsResourceAllocationMode
  enforcementApplied: boolean
  requestedBy: string | null
  timestamp: string
  blockingConditions: string[]
  confidence: number
}
