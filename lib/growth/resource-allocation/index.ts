/** SV1-1 — Resource Allocation Facade public surface. */

export {
  AI_OS_INVESTMENT_STATES,
  AI_OS_RESOURCE_ALLOCATION_DEFAULT_MODE,
  AI_OS_RESOURCE_ALLOCATION_MODE,
  AI_OS_RESOURCE_ALLOCATION_QA_MARKER,
  AI_OS_RESOURCE_COST_TIER_BY_CLASS,
  AI_OS_RESOURCE_COST_TIERS,
  AI_OS_SCARCE_RESOURCE_CLASSES,
  type AiOsInvestmentState,
  type AiOsResourceAllocationAdmissionSignal,
  type AiOsResourceAllocationDecision,
  type AiOsResourceAllocationLedgerEntry,
  type AiOsResourceAllocationMode,
  type AiOsResourceAllocationRequest,
  type AiOsResourceAllocationSupportingSignals,
  type AiOsResourceCostTier,
  type AiOsScarceResourceClass,
} from "@/lib/growth/resource-allocation/resource-allocation-types"

export {
  authorizeSpendForInvestmentState,
  costTierForResource,
  evaluateResourceAllocationFacade,
  projectInvestmentStateFromSignals,
} from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"

export {
  buildAdmissionSignalFromLeadMetadata,
  buildResourceAllocationSignalsFromLead,
} from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
