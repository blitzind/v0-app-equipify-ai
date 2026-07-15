/** GE-AIOS-AUTONOMOUS-PORTFOLIO-MANAGER-1A — Portfolio manager types (client-safe). */

import type {
  BusinessProfileDraftContent,
  BusinessProfilePortfolioManagementSection,
} from "@/lib/growth/business-profile/business-profile-types"

export const GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER =
  "ge-aios-autonomous-portfolio-manager-1a-v1" as const

export const GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY =
  "ge-aios-portfolio-manager-1a" as const

export const DEFAULT_PORTFOLIO_TARGET_ACTIVE_COMPANIES = 100 as const
export const DEFAULT_PORTFOLIO_MINIMUM_HEALTHY_COMPANIES = 40 as const
export const DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE = 25 as const
export const DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY = 50 as const
export const DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH = 20 as const
export const DEFAULT_PORTFOLIO_MAXIMUM_QUEUED_ADMISSIONS = 50 as const

export type { BusinessProfilePortfolioManagementSection }

export type GrowthPortfolioTargetProjection = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  targetActiveCompanies: number
  minimumHealthyCompanies: number
  replenishBatchSize: number
  maximumDailyDiscovery: number
  maximumConcurrentResearch: number
  maximumQueuedAdmissions: number
  source: "business_profile" | "defaults"
}

export type GrowthPortfolioHealthState =
  | "healthy"
  | "needs_replenishment"
  | "critically_low"
  | "operator_intervention_required"

export type GrowthPortfolioHealthCounts = {
  activeCompanies: number
  researching: number
  awaitingAdmission: number
  awaitingReview: number
  qualified: number
  archived: number
  rejected: number
  invalid: number
  discoveryRemaining: number
}

export type GrowthPortfolioHealthReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  healthState: GrowthPortfolioHealthState
  counts: GrowthPortfolioHealthCounts
  needsCount: number
  approvedProfilePresent: boolean
  discoveryRunning: boolean
  researchRunning: boolean
  admissionsPending: number
}

export type GrowthPortfolioManagerMemory = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  lastDiscoveryAt: string | null
  lastDiscoveryCount: number
  lastDiscoveryQualityScore: number | null
  discoveriesToday: number
  discoveriesTodayDate: string | null
  averageAdmissionRate: number | null
  averageQualificationRate: number | null
  averageResearchSuccessRate: number | null
}

export type GrowthPortfolioReplenishmentDecision = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  shouldReplenish: boolean
  batchSize: number
  reason: string | null
  blockedByDailyLimit: boolean
  blockedByQueueLimit: boolean
  blockedByResearchLimit: boolean
  duplicateDiscoveryPrevented: boolean
}

export type GrowthPortfolioManagerOperatorProjection = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  targetActiveCompanies: number
  currentActiveCompanies: number
  minimumHealthyCompanies: number
  needsCount: number
  healthState: GrowthPortfolioHealthState
  healthLabel: string
  discoveryRunning: boolean
  discoveryRunningCount: number
  discoveryStatusDisplay: string
  nextBatchSize: number | null
  showEstimatedHealthy: boolean
  researchRunning: boolean
  researchRunningCount: number
  admissionsPending: number
  projectedCompletionLabel: string | null
  manualFindOptions: readonly number[]
}

export type GrowthPortfolioManagerSnapshot = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PORTFOLIO_MANAGER_1A_QA_MARKER
  target: GrowthPortfolioTargetProjection
  health: GrowthPortfolioHealthReadModel
  memory: GrowthPortfolioManagerMemory
  replenishment: GrowthPortfolioReplenishmentDecision
  operator: GrowthPortfolioManagerOperatorProjection
  /** Deferred Market Intelligence Loop — always null in Portfolio Manager 1A deployment scope. */
  marketIntelligence: null
}

export type PortfolioManagerBusinessProfile = Pick<
  BusinessProfileDraftContent,
  "idealCustomers" | "portfolioManagement"
>
