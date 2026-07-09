/** GE-AIOS-12A — Ava Organizational Memory (canonical export). */

export {
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY,
  type AvaMemoryCategory,
  type AvaMemoryEntityType,
  type AvaMemoryEvent,
  type AvaMemoryEventSource,
  type AvaMemoryPattern,
  type AvaMemorySummary,
  type AvaMemoryTimelinePeriod,
  type AvaMemoryCorrection,
  type AvaOrganizationalPreference,
  type AvaOrganizationalMemoryStore,
  type MemoryEngineAdapterInput,
} from "@/lib/growth/memory/types"

export {
  runMemoryEngine,
  rememberConversation,
  rememberOutcome,
  rememberPreference,
  forgetMemory,
  type RunMemoryEngineInput,
} from "@/lib/growth/memory/engine/run-memory-engine"

export {
  readOrganizationalMemoryStore,
  writeOrganizationalMemoryStore,
  mergeOrganizationalMemoryStore,
  resolvePersistedOrganizationalMemoryStore,
} from "@/lib/growth/memory/storage/organization-memory-store"

export {
  GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS,
  type GrowthHomeOrganizationMemoryPayload,
  type OrganizationMemoryPersistResult,
} from "@/lib/growth/memory/storage/organization-memory-types"

export {
  GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS,
  type GrowthHomeOrganizationalKnowledgePayload,
  type OrganizationalKnowledgeItem,
  type OrganizationalKnowledgeStore,
} from "@/lib/growth/memory/knowledge/organization-knowledge-types"

export {
  buildOrganizationalKnowledge,
  buildKnowledgeFromBusinessIntelligence,
  buildKnowledgeFromMemoryEvents,
  buildKnowledgeInsightBullets,
  buildKnowledgeNarrativeLines,
  mergeOrganizationalKnowledgeItems,
} from "@/lib/growth/memory/knowledge/build-organizational-knowledge"

export { recordMemoryEvents, inferIndustry } from "@/lib/growth/memory/events/record-memory-event"
export { buildOrganizationMemoryTimeline, buildTimelineNarrativeLine } from "@/lib/growth/memory/timeline/organization-memory-timeline"
export { summarizeMemoryPeriod, buildLearnedInsights } from "@/lib/growth/memory/summaries/summarize-memory-period"
export { buildOrganizationPreferences } from "@/lib/growth/memory/preferences/organization-preferences"
export { detectMemoryPatterns, memoryPatternMatchesCandidate } from "@/lib/growth/memory/patterns/detect-patterns"
export {
  buildBusinessIntelligenceMemoryEvents,
  buildBusinessIntelligenceCorrections,
} from "@/lib/growth/memory/bridges/business-intelligence-memory"
export {
  applyMemoryToDecisionContext,
  applyMemoryConfidenceBoost,
  buildMemoryDecisionReasons,
} from "@/lib/growth/memory/bridges/decision-memory"
export {
  buildMemoryNarrativeLines,
  buildMemoryStoryBlocks,
  buildWhatIveLearnedBullets,
  AVA_MEMORY_WHAT_IVE_LEARNED_TITLE,
} from "@/lib/growth/memory/bridges/narrative-memory"
