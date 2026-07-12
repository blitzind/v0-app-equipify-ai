/** SV1-3 — Autonomous Draft Factory types (client-safe). */

import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import type { AiOsPortfolioState } from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export const AI_OS_DRAFT_FACTORY_QA_MARKER = "sv1-3-draft-factory-v1" as const

export const AI_OS_DRAFT_FACTORY_MODE = ["shadow", "active"] as const
export type AiOsDraftFactoryMode = (typeof AI_OS_DRAFT_FACTORY_MODE)[number]

/** Default: active orchestration for pipeline state; never sends. */
export const AI_OS_DRAFT_FACTORY_DEFAULT_MODE: AiOsDraftFactoryMode = "active"

export const AI_OS_DRAFT_FACTORY_STATES = [
  "waiting_for_research",
  "research_complete",
  "waiting_for_dm",
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
  "waiting_for_approval",
  "approved",
  "executed",
  "rejected",
  "paused",
  "failed",
] as const

export type AiOsDraftFactoryState = (typeof AI_OS_DRAFT_FACTORY_STATES)[number]

export const AI_OS_DRAFT_FACTORY_STAGES = [
  "admission",
  "research",
  "knowledge",
  "investment",
  "portfolio",
  "decision_maker",
  "personalization",
  "generation",
  "approval_queue",
] as const

export type AiOsDraftFactoryStage = (typeof AI_OS_DRAFT_FACTORY_STAGES)[number]

export const AI_OS_DRAFT_FACTORY_WAKE_SOURCES = [
  "new_lead",
  "stale_research",
  "newly_available_capacity",
  "decision_maker_discovered",
  "personalization_improved",
  "approval_rejected",
  "company_changed",
  "manual_rebuild",
  "portfolio_selected",
  "outreach_preparation_wake",
  "decision_maker_required",
  "datamoon_person_requested",
  "datamoon_person_completed",
  "datamoon_person_failed",
  "contact_verified",
  "contact_verification_failed",
  "decision_maker_rejected",
  "provider_capacity_available",
] as const

export type AiOsDraftFactoryWakeSource = (typeof AI_OS_DRAFT_FACTORY_WAKE_SOURCES)[number]

export const AI_OS_DRAFT_FACTORY_CAPACITY = {
  maxPackagesPerHour: 25,
  maxPackagesPerDay: 100,
  maxConcurrentPerLead: 1,
  maxOvernightBatch: 100,
} as const

export type AiOsDraftFactoryStageFlags = {
  admitted: boolean
  researchCurrent: boolean
  knowledgeComplete: boolean
  investmentEligible: boolean
  portfolioSelected: boolean
  decisionMakerAvailable: boolean
  personalizationReady: boolean
  draftValid: boolean
  inApprovalQueue: boolean
  approved: boolean
  rejected: boolean
  executed: boolean
  paused: boolean
  failed: boolean
}

export type AiOsDraftFactorySignals = {
  admissionState?: "accepted" | "review" | "rejected" | "invalid" | "unknown" | null
  researchFresh?: boolean | null
  researchStale?: boolean | null
  hasUsableResearch?: boolean | null
  knowledgeComplete?: boolean | null
  investmentState?: AiOsInvestmentState | null
  spendAuthorized?: boolean | null
  portfolioSelected?: boolean | null
  portfolioState?: AiOsPortfolioState | null
  decisionMakerStatus?: string | null
  hasPrimaryDecisionMaker?: boolean | null
  hasContactName?: boolean | null
  personalizationReady?: boolean | null
  hasRecentApprovalPackage?: boolean | null
  approvalDecision?: "approved" | "rejected" | null
  transportBlocked?: boolean | null
  budgetAvailable?: boolean | null
  killSwitchActive?: boolean | null
  companySummary?: string | null
  missionId?: string | null
  selectedBecause?: string | null
}

export type AiOsDraftFactoryExplainability = {
  whySelected: string
  whyNow: string
  whyDecisionMaker: string
  whyOutreach: string
  whySequence: string
  whySubject: string
  whyRecommendation: string
  supportingEvidence: string[]
}

export type AiOsDraftFactoryPackage = {
  qaMarker: typeof AI_OS_DRAFT_FACTORY_QA_MARKER
  factoryPackageId: string
  leadId: string
  organizationId: string
  companyName: string | null
  companySummary: string
  decisionMaker: {
    available: boolean
    status: string | null
    summary: string
  }
  evidence: string[]
  knowledgePackSummary: string | null
  personalizationRationale: string[]
  recommendedChannel: string
  recommendedSequence: string
  subjectLines: string[]
  emailDrafts: string[]
  callOpening: string | null
  linkedInOpener: string | null
  confidence: number
  reasons: string[]
  supportingEvidence: string[]
  approvalRequirements: string[]
  nextRecommendedAction: string
  explainability: AiOsDraftFactoryExplainability
  pendingHumanApproval: true
  transportBlocked: true
  /** Canonical 5F approval package — Draft Factory never replaces it. */
  growth5fApprovalPackage: GrowthAutonomousOutreachApprovalPackage | null
  preparedAt: string
  factoryState: AiOsDraftFactoryState
}

export type AiOsDraftFactoryLeadRecord = {
  leadId: string
  organizationId: string
  companyName: string | null
  state: AiOsDraftFactoryState
  earliestIncompleteStage: AiOsDraftFactoryStage | null
  stageFlags: AiOsDraftFactoryStageFlags
  wakeSource: AiOsDraftFactoryWakeSource | null
  package: AiOsDraftFactoryPackage | null
  lastAdvancedAt: string
  lastError: string | null
  lockOwner: string | null
  version: number
}

export type AiOsDraftFactoryAdvanceResult = {
  qaMarker: typeof AI_OS_DRAFT_FACTORY_QA_MARKER
  leadId: string
  previousState: AiOsDraftFactoryState
  nextState: AiOsDraftFactoryState
  stagesSkipped: AiOsDraftFactoryStage[]
  stageExecuted: AiOsDraftFactoryStage | null
  resumedFrom: AiOsDraftFactoryStage | null
  package: AiOsDraftFactoryPackage | null
  blockedReason: string | null
  duplicatePrevented: boolean
  transportBlocked: true
  mode: AiOsDraftFactoryMode
}

export type AiOsDraftFactoryBatchResult = {
  qaMarker: typeof AI_OS_DRAFT_FACTORY_QA_MARKER
  organizationId: string
  evaluated: number
  advanced: number
  packagesReady: number
  skippedBudget: number
  skippedIneligible: number
  failed: number
  duplicatesPrevented: number
  capacity: {
    maxPackagesPerDay: number
    used: number
    remaining: number
  }
  results: AiOsDraftFactoryAdvanceResult[]
  decidedAt: string
}
