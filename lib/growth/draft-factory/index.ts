/** SV1-3 / SV1-5 — Draft Factory public surface. */

export {
  AI_OS_DRAFT_FACTORY_CAPACITY,
  AI_OS_DRAFT_FACTORY_DEFAULT_MODE,
  AI_OS_DRAFT_FACTORY_MODE,
  AI_OS_DRAFT_FACTORY_QA_MARKER,
  AI_OS_DRAFT_FACTORY_STAGES,
  AI_OS_DRAFT_FACTORY_STATES,
  AI_OS_DRAFT_FACTORY_WAKE_SOURCES,
  type AiOsDraftFactoryAdvanceResult,
  type AiOsDraftFactoryBatchResult,
  type AiOsDraftFactoryExplainability,
  type AiOsDraftFactoryLeadRecord,
  type AiOsDraftFactoryMode,
  type AiOsDraftFactoryPackage,
  type AiOsDraftFactorySignals,
  type AiOsDraftFactoryStage,
  type AiOsDraftFactoryStageFlags,
  type AiOsDraftFactoryState,
  type AiOsDraftFactoryWakeSource,
} from "@/lib/growth/draft-factory/draft-factory-types"

export {
  applyAdvanceToRecord,
  applyWakeToFlags,
  assembleDraftFactoryPackage,
  buildDraftFactoryExplainability,
  buildDraftFactoryStageFlags,
  createDraftFactoryLeadRecord,
  listSkippedStagesBefore,
  planDraftFactoryAdvance,
  projectDraftFactoryState,
  resolveEarliestIncompleteStage,
  runDraftFactoryOvernightBatch,
  wakeShouldForceRebuild,
} from "@/lib/growth/draft-factory/draft-factory-engine"

/** SV1-5 — Durable wake-chain surface */
export {
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  AI_OS_DRAFT_FACTORY_CANONICAL_WAKES,
  AI_OS_DRAFT_FACTORY_DURABLE_STAGES,
  AI_OS_DRAFT_FACTORY_DURABLE_STATES,
  AI_OS_DRAFT_FACTORY_WAKE_NORMALIZATION,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"

export {
  advanceDraftFactoryBatch,
  advanceDraftFactoryCapacityWake,
  advanceDraftFactoryForLead as advanceDraftFactoryForLeadDurable,
  listDueDraftFactoryStates,
  recordDraftFactoryWake,
  reconstructDraftFactoryStateFromCanonicalData,
  normalizeDraftFactoryWake,
  buildDraftFactoryWakeFingerprint,
  getDeferredDraftFactoryStates,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"

export {
  GROWTH_AIOS_AUTONOMY_1B_PHASE,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
  GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID,
  GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES,
  GROWTH_DRAFT_FACTORY_DUE_SCHEDULER_QA_MARKER,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"

export { mapAiOsEventToDraftFactoryWakePlans } from "@/lib/growth/draft-factory/draft-factory-wake-event-mapper"

export { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"

export {
  resolveDraftFactoryDurableRepositoryKind,
} from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"

export {
  clearDurableDraftFactoryStoreForTests,
  getDurableDraftFactoryLeadState,
  isDraftFactoryInMemoryStoreAuthoritative,
  simulateDraftFactoryProcessRestart,
  exportDurableDraftFactorySnapshot,
  importDurableDraftFactorySnapshot,
} from "@/lib/growth/draft-factory/draft-factory-durable-store"
