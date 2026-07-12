/** SV1-2 / ARCH-2A — Portfolio Allocation Facade types (client-safe). */

import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"

export const AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER = "sv1-2-portfolio-allocation-facade-v1" as const

export const AI_OS_PORTFOLIO_ALLOCATION_MODE = ["shadow", "enforce"] as const
export type AiOsPortfolioAllocationMode = (typeof AI_OS_PORTFOLIO_ALLOCATION_MODE)[number]

/** Production default until enforce parity is certified. */
export const AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE: AiOsPortfolioAllocationMode = "shadow"

/**
 * Ranker composition authority (no new scoring engine):
 * 1. Mission alignment — strategic relevance filter / boost context
 * 2. 4F Mission Priority — primary mission-relative overallPriority
 * 3. Meta Recommender / Priority Binding — secondary cross-signal score / binding rank
 * 4. Daily Revenue Queue — tertiary scheduling / capacity context (sortScore)
 * 5. Lead urgency / freshness / engagement — provided signals only (tie-break / explainability)
 * Decision Engine / Work Manager — operator-day tools, NOT global portfolio authority
 */
export const AI_OS_PORTFOLIO_RANKER_AUTHORITY = {
  missionAlignment: "strategic_relevance",
  missionPriority4f: "primary_priority",
  metaOrPriorityBinding: "secondary_cross_signal",
  dailyRevenueQueue: "capacity_scheduling_context",
  leadSignals: "explainability_and_tiebreak",
  decisionEngine: "operator_day_not_portfolio_authority",
  workManager: "operator_day_not_portfolio_authority",
} as const

export const AI_OS_PORTFOLIO_STATES = [
  "highest_priority",
  "active_investment",
  "queued",
  "deferred",
  "monitoring",
  "paused",
  "archived",
  "completed",
] as const

export type AiOsPortfolioState = (typeof AI_OS_PORTFOLIO_STATES)[number]

export const AI_OS_PORTFOLIO_CAPACITY_CLASSES = [
  "website_research",
  "cheap_validation",
  "datamoon_company_enrichment",
  "datamoon_person_enrichment",
  "decision_maker_discovery",
  "llm_drafting",
  "sequence_preparation",
  "voice_generation",
  "sms_generation",
  "browser_automation",
  "human_approval",
  "outreach_send",
] as const

export type AiOsPortfolioCapacityClass = (typeof AI_OS_PORTFOLIO_CAPACITY_CLASSES)[number]

/** Scarce vs inexpensive capacity for ARCH-1A eligibility filtering. */
export const AI_OS_PORTFOLIO_CAPACITY_COST: Record<
  AiOsPortfolioCapacityClass,
  "inexpensive" | "scarce" | "outbound" | "human"
> = {
  website_research: "inexpensive",
  cheap_validation: "inexpensive",
  datamoon_company_enrichment: "scarce",
  datamoon_person_enrichment: "scarce",
  decision_maker_discovery: "scarce",
  llm_drafting: "scarce",
  sequence_preparation: "scarce",
  voice_generation: "outbound",
  sms_generation: "outbound",
  browser_automation: "scarce",
  human_approval: "human",
  outreach_send: "outbound",
}

export type AiOsPortfolioCandidateSignals = {
  missionAligned?: boolean | null
  missionPriorityOverall?: number | null
  missionQueueBucket?: string | null
  missionAllocationStatus?: string | null
  metaRecommendationScore?: number | null
  priorityBindingRank?: number | null
  priorityBindingScore?: number | null
  dailyQueueSortScore?: number | null
  dailyQueuePriority?: string | null
  researchFresh?: boolean | null
  researchStale?: boolean | null
  engagementScore?: number | null
  urgencyScore?: number | null
  opportunityValue?: number | null
  completed?: boolean | null
  paused?: boolean | null
  killSwitchActive?: boolean | null
}

export type AiOsPortfolioCandidate = {
  leadId: string
  organizationId: string
  missionId?: string | null
  objectiveId?: string | null
  companyName?: string | null
  /** SV1-1 decision — required for scarce capacity; missing → fail closed for scarce. */
  investmentState?: AiOsInvestmentState | null
  spendAuthorized?: boolean | null
  resourceAllocationReason?: string | null
  signals?: AiOsPortfolioCandidateSignals | null
}

export type AiOsPortfolioAllocationRequest = {
  organizationId: string
  capacityClass: AiOsPortfolioCapacityClass
  capacitySlotsAvailable: number
  candidates: AiOsPortfolioCandidate[]
  /** Existing production selector lead IDs for shadow comparison. */
  existingSelectedLeadIds?: string[]
  mode?: AiOsPortfolioAllocationMode
  decidedAt?: string
}

export type AiOsPortfolioDecision = {
  lead_id: string
  organization_id: string
  mission_id: string | null
  objective_id: string | null
  investment_state: AiOsInvestmentState | "unknown"
  portfolio_state: AiOsPortfolioState
  selected: boolean
  rank: number | null
  priority_score: number
  capacity_class: AiOsPortfolioCapacityClass
  capacity_slot: number | null
  reason: string
  selected_because: string | null
  deferred_because: string | null
  supporting_signals: AiOsPortfolioCandidateSignals & {
    eligibility: string
    composition: string
  }
  competing_account_count: number
  estimated_capacity_cost: "inexpensive" | "scarce" | "outbound" | "human"
  mode: AiOsPortfolioAllocationMode
  enforcement_applied: false
  decided_at: string
  qa_marker: typeof AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER
}

export type AiOsPortfolioAllocationCycleResult = {
  qaMarker: typeof AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER
  organizationId: string
  capacityClass: AiOsPortfolioCapacityClass
  capacitySlotsAvailable: number
  capacitySlotsFilled: number
  mode: AiOsPortfolioAllocationMode
  enforcement_applied: false
  decided_at: string
  decisions: AiOsPortfolioDecision[]
  selectedLeadIds: string[]
  deferredLeadIds: string[]
  existingSelectedLeadIds: string[]
  overlapLeadIds: string[]
  mismatch: {
    facadeOnly: string[]
    existingOnly: string[]
    reasons: string[]
  }
}

export type AiOsPortfolioLedgerEntry = {
  qaMarker: typeof AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER
  entryId: string
  organizationId: string
  capacityClass: AiOsPortfolioCapacityClass
  capacityAvailable: number
  capacityFilled: number
  evaluatedAccountIds: string[]
  selectedAccountIds: string[]
  deferredAccountIds: string[]
  decisions: Array<{
    leadId: string
    rank: number | null
    portfolioState: AiOsPortfolioState
    investmentState: AiOsInvestmentState | "unknown"
    selected: boolean
    priorityScore: number
    missionId: string | null
    reason: string
    selectedBecause: string | null
    deferredBecause: string | null
  }>
  displacementNotes: string[]
  existingSelectedLeadIds: string[]
  overlapLeadIds: string[]
  mismatchReasons: string[]
  mode: AiOsPortfolioAllocationMode
  enforcementApplied: false
  timestamp: string
}
