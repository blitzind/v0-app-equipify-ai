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

function mergeEvents(
  existing: AvaOrganizationalMemoryStore | null | undefined,
  incoming: AvaOrganizationalMemoryStore,
): AvaOrganizationalMemoryStore {
  const eventIds = new Set((existing?.events ?? []).map((row) => row.id))
  const mergedEvents = [...(existing?.events ?? [])]
  for (const event of incoming.events) {
    if (eventIds.has(event.id)) continue
    mergedEvents.push(event)
    eventIds.add(event.id)
  }
  return {
    ...incoming,
    events: mergedEvents.slice(-500),
    preferences: incoming.preferences,
  }
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

  const preferences = buildOrganizationPreferences({
    generatedAt: input.generatedAt,
    workspaceSummary: input.workspaceSummary,
    narrativeContext,
    events: [...recorded.events, ...biEvents],
    existingPreferences: input.persistedStore?.preferences,
  })

  const draftStore = buildMemoryStoreFromEvents({
    organizationId,
    generatedAt: input.generatedAt,
    events: [...recorded.events, ...biEvents],
    preferences,
    existingPreferences: preferences,
  })

  const store = mergeEvents(input.persistedStore, draftStore)
  const detected_patterns = detectMemoryPatterns(store.events)
  const timeline = buildOrganizationMemoryTimeline({
    events: store.events,
    generatedAt: input.generatedAt,
  })
  const corrections = buildBusinessIntelligenceCorrections({
    narrativeContext,
    generatedAt: input.generatedAt,
  })
  const period_summary = summarizeMemoryPeriod({
    events: store.events,
    timeline,
    generatedAt: input.generatedAt,
  })
  const learned_insights = buildLearnedInsights({
    patterns: detected_patterns,
    preferences: store.preferences,
    events: store.events,
    corrections,
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
  }

  return { summary, store }
}

export { type RunMemoryEngineInput as MemoryEngineInput }
