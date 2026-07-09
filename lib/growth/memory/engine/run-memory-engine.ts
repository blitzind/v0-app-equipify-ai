/** GE-AIOS-12A — Canonical Memory Engine orchestrator (deterministic, no execution). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildAvaNarrativeContext,
  type BuildAvaNarrativeContextInput,
} from "@/lib/growth/ava-home/narrative/context/build-ava-narrative-context"
import {
  buildBusinessIntelligenceCorrections,
  buildBusinessIntelligenceMemoryEvents,
} from "@/lib/growth/memory/bridges/business-intelligence-memory"
import { extractSalesOutcomeMemoryEvents } from "@/lib/growth/specialists/execution/sales-specialist-memory-bridge"
import type { SalesOutcome } from "@/lib/growth/specialists/execution/sales-outcome-types"
import {
  buildKnowledgeInsightBullets,
  buildOrganizationalKnowledge,
} from "@/lib/growth/memory/knowledge/build-organizational-knowledge"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import {
  buildMemoryStoreFromEvents,
  recordMemoryEvents,
} from "@/lib/growth/memory/events/record-memory-event"
import { detectMemoryPatterns } from "@/lib/growth/memory/patterns/detect-patterns"
import {
  buildOrganizationPreferences,
  buildUnansweredQuestions,
} from "@/lib/growth/memory/preferences/organization-preferences"
import {
  buildLearnedInsights,
  summarizeMemoryPeriod,
} from "@/lib/growth/memory/summaries/summarize-memory-period"
import { buildOrganizationMemoryTimeline } from "@/lib/growth/memory/timeline/organization-memory-timeline"
import { mergeOrganizationalMemoryStore } from "@/lib/growth/memory/storage/organization-memory-store"
import {
  GROWTH_MEMORY_ENGINE_QA_MARKER,
  type AvaMemorySummary,
  type AvaOrganizationalMemoryStore,
  type MemoryEngineAdapterInput,
} from "@/lib/growth/memory/types"

export type RunMemoryEngineInput = {
  organizationId?: string
  generatedAt: string
  workspaceSummary: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard"
  >
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  accomplishments: GrowthHomeAccomplishmentGroup[]
  timeline: GrowthHomeTimelinePeriod[]
  persistedStore?: AvaOrganizationalMemoryStore | null
  adapters?: MemoryEngineAdapterInput
  salesOutcomes?: SalesOutcome[]
  salesDailySummary?: import("@/lib/growth/specialists/execution/sales-outcome-types").SalesOutcomeDailySummary | null
  /** GE-AIOS-17C — Server-hydrated organizational knowledge (canonical when present) */
  organizationalKnowledge?: OrganizationalKnowledgeItem[] | null
  /** GE-AIOS-17C — BI report for client-side knowledge rebuild when server payload absent */
  businessIntelligenceReport?: import("@/lib/growth/business-intelligence/business-intelligence-types").BusinessIntelligenceReport | null
}

/** Future hooks — NOT implemented in 12A. */
export function rememberConversation(): { remembered: false; reason: "deterministic_only" } {
  return { remembered: false, reason: "deterministic_only" }
}

export function rememberOutcome(): { remembered: false; reason: "deterministic_only" } {
  return { remembered: false, reason: "deterministic_only" }
}

export function rememberPreference(): { remembered: false; reason: "deterministic_only" } {
  return { remembered: false, reason: "deterministic_only" }
}

export function forgetMemory(): { forgotten: false; reason: "deterministic_only" } {
  return { forgotten: false, reason: "deterministic_only" }
}

function mergePersistedStore(
  existing: AvaOrganizationalMemoryStore | null | undefined,
  incoming: AvaOrganizationalMemoryStore,
): AvaOrganizationalMemoryStore {
  return mergeOrganizationalMemoryStore(existing, incoming)
}

export function runMemoryEngine(input: RunMemoryEngineInput): {
  summary: AvaMemorySummary
  store: AvaOrganizationalMemoryStore
} {
  const organizationId = input.organizationId ?? "local-organization"
  const narrativeInput: BuildAvaNarrativeContextInput = {
    workspaceSummary: input.workspaceSummary,
    accomplishments: input.accomplishments,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    timeline: input.timeline,
  }
  const narrativeContext = buildAvaNarrativeContext(narrativeInput)

  const recorded = recordMemoryEvents({
    organizationId,
    generatedAt: input.generatedAt,
    workspaceSummary: input.workspaceSummary,
    waitingOnYou: input.waitingOnYou,
    dailyWorkQueue: input.dailyWorkQueue,
    accomplishments: input.accomplishments,
    timeline: input.timeline,
    narrativeContext,
    adapters: input.adapters,
  })

  const biEvents = buildBusinessIntelligenceMemoryEvents({
    organizationId,
    generatedAt: input.generatedAt,
    workspaceSummary: input.workspaceSummary,
    narrativeContext,
  })

  const salesOutcomeEvents = extractSalesOutcomeMemoryEvents(input.salesOutcomes ?? [])

  const preferences = buildOrganizationPreferences({
    generatedAt: input.generatedAt,
    workspaceSummary: input.workspaceSummary,
    narrativeContext,
    events: [...recorded.events, ...biEvents, ...salesOutcomeEvents],
    existingPreferences: input.persistedStore?.preferences,
  })

  const draftStore = buildMemoryStoreFromEvents({
    organizationId,
    generatedAt: input.generatedAt,
    events: [...recorded.events, ...biEvents, ...salesOutcomeEvents],
    preferences,
    existingPreferences: preferences,
  })

  const store = mergePersistedStore(input.persistedStore, draftStore)
  const detected_patterns = detectMemoryPatterns(store.events)
  const timeline = buildOrganizationMemoryTimeline({
    events: store.events,
    generatedAt: input.generatedAt,
  })
  const corrections = buildBusinessIntelligenceCorrections({
    narrativeContext,
    generatedAt: input.generatedAt,
  })

  const resolvedKnowledge =
    input.organizationalKnowledge && input.organizationalKnowledge.length > 0
      ? input.organizationalKnowledge
      : buildOrganizationalKnowledge({
          organizationId,
          generatedAt: input.generatedAt,
          report: input.businessIntelligenceReport ?? null,
          memoryEvents: store.events,
          salesOutcomes: input.salesOutcomes ?? [],
        })

  const period_summary = summarizeMemoryPeriod({
    events: store.events,
    timeline,
    generatedAt: input.generatedAt,
    salesDailySummary: input.salesDailySummary ?? null,
  })
  const learned_insights = buildLearnedInsights({
    patterns: detected_patterns,
    preferences: store.preferences,
    events: store.events,
    corrections,
    organizationalKnowledge: resolvedKnowledge,
  })

  const sortedEvents = [...store.events].sort(
    (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  )

  const summary: AvaMemorySummary = {
    qaMarker: GROWTH_MEMORY_ENGINE_QA_MARKER,
    recent_events: sortedEvents.slice(0, 12),
    important_events: sortedEvents
      .filter((row) => row.importance >= 4)
      .slice(0, 8),
    preferences: store.preferences,
    detected_patterns,
    corrections,
    unanswered_questions: buildUnansweredQuestions({ narrativeContext, preferences: store.preferences }),
    timeline,
    learned_insights,
    period_summary,
    organizational_knowledge: resolvedKnowledge,
  }

  return { summary, store }
}

export { type RunMemoryEngineInput as MemoryEngineInput }
