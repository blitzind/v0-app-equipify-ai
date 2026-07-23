/** GE-AIOS-17A — Sales Specialist → Memory bridge. Delegates to @fuzor/memory. */

export {
  attachPlatformMemoryEventsToSalesOutcomes as attachMemoryEventsToSalesOutcomes,
  buildPlatformCompletedWorkNarrativeLines as buildCompletedWorkNarrativeLines,
  buildPlatformSalesCompletedWorkPeriodSummary as buildSalesCompletedWorkPeriodSummary,
  buildPlatformSalesOutcomeMemoryEvent as buildSalesOutcomeMemoryEvent,
  extractPlatformSalesOutcomeMemoryEvents as extractSalesOutcomeMemoryEvents,
  PLATFORM_SALES_SPECIALIST_MEMORY_SOURCE as SALES_SPECIALIST_MEMORY_SOURCE,
} from "@fuzor/memory"
