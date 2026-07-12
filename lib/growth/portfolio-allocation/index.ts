/** SV1-2 — Portfolio Allocation Facade public surface. */

export {
  AI_OS_PORTFOLIO_ALLOCATION_DEFAULT_MODE,
  AI_OS_PORTFOLIO_ALLOCATION_MODE,
  AI_OS_PORTFOLIO_ALLOCATION_QA_MARKER,
  AI_OS_PORTFOLIO_CAPACITY_CLASSES,
  AI_OS_PORTFOLIO_CAPACITY_COST,
  AI_OS_PORTFOLIO_RANKER_AUTHORITY,
  AI_OS_PORTFOLIO_STATES,
  type AiOsPortfolioAllocationCycleResult,
  type AiOsPortfolioAllocationMode,
  type AiOsPortfolioAllocationRequest,
  type AiOsPortfolioCandidate,
  type AiOsPortfolioCandidateSignals,
  type AiOsPortfolioCapacityClass,
  type AiOsPortfolioDecision,
  type AiOsPortfolioLedgerEntry,
  type AiOsPortfolioState,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-types"

export {
  buildPortfolioDisplacementNotes,
  composePortfolioPriorityScore,
  evaluatePortfolioAllocationFacade,
  evaluatePortfolioEligibility,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-facade-engine"

export {
  inferPortfolioCapacityClassFromMissionType,
  mapMissionAllocationToPortfolioCandidate,
} from "@/lib/growth/portfolio-allocation/portfolio-allocation-mappers"
