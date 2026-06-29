/** GE-AI-3D — Closed-Loop Learning service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import { getGrowthAiEventBusSubscriberObservation } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import {
  buildGrowthLearningAdvisoryContext,
  buildGrowthLearningCommunicationAdvisory,
  synthesizeGrowthLearningInsights,
} from "@/lib/growth/aios/learning/growth-learning-insight-engine"
import {
  appendClosedLoopLearningEvent,
  listCurrentClosedLoopLearningInsights,
  listRecentClosedLoopLearningOutcomes,
  summarizeClosedLoopLearningByOrganization,
  upsertClosedLoopLearningInsight,
  upsertClosedLoopLearningOutcome,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-repository"
import { isGrowthClosedLoopLearningSchemaReady } from "@/lib/growth/aios/learning/growth-closed-loop-learning-schema-health"
import {
  buildLearningOutcomeId,
  normalizeLearningOutcomeFromEvent,
} from "@/lib/growth/aios/learning/growth-learning-outcome-normalizer"
import {
  GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES,
  GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER,
  GROWTH_CLOSED_LOOP_LEARNING_RULE,
  GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID,
  GROWTH_LEARNING_OUTCOME_STORE_MAX,
  buildLearningInsightIdempotencyKey,
  buildLearningOutcomeIdempotencyKey,
  resolveLearningInsightWindow,
  type GrowthClosedLoopLearningReadModel,
  type GrowthLearningInsight,
  type GrowthLearningOutcome,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { scheduleUnifiedRevenueWorkflowLifecycleReEvaluation } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"

/** Test-only in-memory store — production paths use repository. */
const outcomeStore = new Map<string, GrowthLearningOutcome[]>()
const insightCache = new Map<string, GrowthLearningInsight[]>()

function useInMemoryLearningStore(): boolean {
  return process.env.GROWTH_LEARNING_IN_MEMORY_STORE === "1"
}

export function resetGrowthClosedLoopLearningStoreForTests(): void {
  outcomeStore.clear()
  insightCache.clear()
}

function getInMemoryOutcomes(organizationId: string): GrowthLearningOutcome[] {
  return outcomeStore.get(organizationId) ?? []
}

function storeInMemoryOutcome(outcome: GrowthLearningOutcome): boolean {
  const existing = getInMemoryOutcomes(outcome.organizationId)
  if (existing.some((row) => row.id === outcome.id)) return false
  const next = [outcome, ...existing].slice(0, GROWTH_LEARNING_OUTCOME_STORE_MAX)
  outcomeStore.set(outcome.organizationId, next)
  insightCache.delete(outcome.organizationId)
  return true
}

export function listStoredLearningOutcomes(organizationId: string): GrowthLearningOutcome[] {
  return getInMemoryOutcomes(organizationId)
}

export function ingestLearningOutcome(outcome: GrowthLearningOutcome): boolean {
  if (!useInMemoryLearningStore()) return false
  return storeInMemoryOutcome(outcome)
}

export function synthesizeEmptyClosedLoopLearningReadModel(input: {
  generatedAt: string
  schemaReady?: boolean
}): GrowthClosedLoopLearningReadModel {
  return buildGrowthClosedLoopLearningReadModelFromData({
    organizationId: "unknown",
    generatedAt: input.generatedAt,
    outcomes: [],
    insights: [],
    schemaReady: input.schemaReady ?? false,
    persistenceMode: input.schemaReady ? "empty" : "empty",
    lastGeneratedAt: null,
    outcomeCount: 0,
  })
}

function buildGrowthClosedLoopLearningReadModelFromData(input: {
  organizationId: string
  generatedAt: string
  outcomes: GrowthLearningOutcome[]
  insights: GrowthLearningInsight[]
  schemaReady: boolean
  persistenceMode: GrowthClosedLoopLearningReadModel["persistenceMode"]
  lastGeneratedAt: string | null
  outcomeCount: number
}): GrowthClosedLoopLearningReadModel {
  const observation = getGrowthAiEventBusSubscriberObservation(GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID)

  return {
    readOnly: true,
    advisoryOnly: true,
    qaMarker: GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_CLOSED_LOOP_LEARNING_RULE,
    schemaReady: input.schemaReady,
    persistenceMode: input.persistenceMode,
    lastGeneratedAt: input.lastGeneratedAt,
    summary: {
      outcomesObserved: input.outcomeCount,
      insightsGenerated: input.insights.length,
      topInsightType: input.insights[0]?.insightType ?? null,
      averageConfidence:
        input.insights.length > 0
          ? input.insights.reduce((sum, row) => sum + row.confidence, 0) / input.insights.length
          : 0,
      notEnoughDataCount: input.insights.filter((row) => row.status === "not_enough_data").length,
    },
    outcomes: input.outcomes.slice(0, 24),
    insights: input.insights,
    eventObservation: {
      subscriberId: GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID,
      eventsReceived: observation?.eventsReceived ?? 0,
      lastEventType: observation?.lastEventType ?? null,
    },
  }
}

export function buildGrowthClosedLoopLearningReadModel(input: {
  organizationId: string
  generatedAt: string
}): GrowthClosedLoopLearningReadModel {
  const outcomes = useInMemoryLearningStore() ? getInMemoryOutcomes(input.organizationId) : []
  const insights =
    useInMemoryLearningStore() && insightCache.has(input.organizationId)
      ? (insightCache.get(input.organizationId) ?? [])
      : synthesizeGrowthLearningInsights({
          organizationId: input.organizationId,
          generatedAt: input.generatedAt,
          outcomes,
        })

  if (useInMemoryLearningStore()) {
    insightCache.set(input.organizationId, insights)
  }

  return buildGrowthClosedLoopLearningReadModelFromData({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    outcomes,
    insights,
    schemaReady: false,
    persistenceMode: useInMemoryLearningStore() ? "in_memory_test" : "empty",
    lastGeneratedAt: insights[0]?.createdAt ?? null,
    outcomeCount: outcomes.length,
  })
}

export async function fetchGrowthClosedLoopLearningReadModel(
  admin: SupabaseClient | null,
  input: { organizationId: string; generatedAt: string },
): Promise<GrowthClosedLoopLearningReadModel> {
  if (useInMemoryLearningStore()) {
    return buildGrowthClosedLoopLearningReadModel(input)
  }

  if (!admin) {
    return synthesizeEmptyClosedLoopLearningReadModel({ generatedAt: input.generatedAt, schemaReady: false })
  }

  let schemaReady = false
  try {
    schemaReady = await isGrowthClosedLoopLearningSchemaReady(admin)
  } catch {
    schemaReady = false
  }

  if (!schemaReady) {
    return synthesizeEmptyClosedLoopLearningReadModel({
      generatedAt: input.generatedAt,
      schemaReady: false,
    })
  }

  try {
    const [outcomes, insights, summary] = await Promise.all([
      listRecentClosedLoopLearningOutcomes(admin, {
        organizationId: input.organizationId,
        limit: GROWTH_LEARNING_OUTCOME_STORE_MAX,
      }),
      listCurrentClosedLoopLearningInsights(admin, { organizationId: input.organizationId }),
      summarizeClosedLoopLearningByOrganization(admin, { organizationId: input.organizationId }),
    ])

    return buildGrowthClosedLoopLearningReadModelFromData({
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
      outcomes,
      insights,
      schemaReady: true,
      persistenceMode: "durable",
      lastGeneratedAt: summary.lastGeneratedAt,
      outcomeCount: summary.outcomeCount,
    })
  } catch {
    return synthesizeEmptyClosedLoopLearningReadModel({
      generatedAt: input.generatedAt,
      schemaReady: false,
    })
  }
}

async function publishLearningLifecycleEvent(
  admin: SupabaseClient | null,
  input: {
    organizationId: string
    eventType: string
    payload: Record<string, unknown>
    occurredAt: string
  },
): Promise<void> {
  if (!admin) return
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: "learning",
      source: "growth_closed_loop_learning",
      producer: "growth_closed_loop_learning_service",
      subjectType: "system",
      subjectId: input.organizationId,
      payload: {
        ...input.payload,
        readOnly: true,
        advisoryOnly: true,
        nonMutating: true,
      },
      metadata: {
        qaMarker: GROWTH_CLOSED_LOOP_LEARNING_QA_MARKER,
        nonMutating: true,
      },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Learning publish must not block observation.
  }
}

async function persistInsightsForOrganization(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt: string; outcomes: GrowthLearningOutcome[] },
): Promise<GrowthLearningInsight[]> {
  const window = resolveLearningInsightWindow(input.generatedAt)
  const synthesized = synthesizeGrowthLearningInsights({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    outcomes: input.outcomes,
  })

  const persisted: GrowthLearningInsight[] = []
  for (const insight of synthesized) {
    const idempotencyKey = buildLearningInsightIdempotencyKey({
      organizationId: input.organizationId,
      insightType: insight.insightType,
      generatedFromWindow: window,
    })
    const { insight: saved, inserted } = await upsertClosedLoopLearningInsight(admin, {
      organizationId: input.organizationId,
      idempotencyKey,
      generatedFromWindow: window,
      insight,
    })
    persisted.push(saved)
    if (inserted) {
      await appendClosedLoopLearningEvent(admin, {
        organizationId: input.organizationId,
        insightId: saved.id,
        eventType: GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES.insightGenerated,
        payload: {
          insightId: saved.id,
          insightType: saved.insightType,
          recommendedAdjustment: saved.recommendedAdjustment,
          targetSystem: saved.targetSystem,
          sampleSize: saved.sampleSize,
          status: saved.status,
        },
      })
    }
  }

  return persisted.sort((a, b) => b.impact - a.impact || b.confidence - a.confidence)
}

export async function observeClosedLoopLearningEvent(
  event: AiOsEvent,
  admin: SupabaseClient | null = null,
): Promise<{ observed: boolean; outcome: GrowthLearningOutcome | null }> {
  const normalized = normalizeLearningOutcomeFromEvent(event)
  if (!normalized) return { observed: false, outcome: null }

  const idempotencyKey = buildLearningOutcomeIdempotencyKey(event.organizationId, event.id)

  if (useInMemoryLearningStore()) {
    const inserted = storeInMemoryOutcome({ ...normalized, id: buildLearningOutcomeId(event.organizationId, event.id) })
    if (!inserted) return { observed: false, outcome: normalized }

    await publishLearningLifecycleEvent(admin, {
      organizationId: event.organizationId,
      eventType: GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES.outcomeObserved,
      occurredAt: normalized.occurredAt,
      payload: {
        outcomeId: normalized.id,
        source: normalized.source,
        outcomeType: normalized.outcomeType,
      },
    })

    const insights = synthesizeGrowthLearningInsights({
      organizationId: event.organizationId,
      generatedAt: new Date().toISOString(),
      outcomes: getInMemoryOutcomes(event.organizationId),
    })
    insightCache.set(event.organizationId, insights)
    return { observed: true, outcome: normalized }
  }

  if (!admin) return { observed: false, outcome: normalized }

  let schemaReady = false
  try {
    schemaReady = await isGrowthClosedLoopLearningSchemaReady(admin)
  } catch {
    return { observed: false, outcome: normalized }
  }
  if (!schemaReady) return { observed: false, outcome: normalized }

  try {
    const { outcome: persisted, inserted } = await upsertClosedLoopLearningOutcome(admin, {
      organizationId: event.organizationId,
      idempotencyKey,
      outcome: { ...normalized, id: buildLearningOutcomeId(event.organizationId, event.id) },
    })

    if (!inserted) return { observed: false, outcome: persisted }

    await appendClosedLoopLearningEvent(admin, {
      organizationId: event.organizationId,
      outcomeId: persisted.id,
      eventType: GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES.outcomeObserved,
      payload: {
        outcomeId: persisted.id,
        source: persisted.source,
        outcomeType: persisted.outcomeType,
        idempotencyKey,
      },
    })

    await publishLearningLifecycleEvent(admin, {
      organizationId: event.organizationId,
      eventType: GROWTH_CLOSED_LOOP_LEARNING_EVENT_TYPES.outcomeObserved,
      occurredAt: persisted.occurredAt,
      payload: {
        outcomeId: persisted.id,
        source: persisted.source,
        outcomeType: persisted.outcomeType,
        subjectType: persisted.subject.type,
        subjectId: persisted.subject.id,
        signalStrength: persisted.signalStrength,
        confidence: persisted.confidence,
      },
    })

    const outcomes = await listRecentClosedLoopLearningOutcomes(admin, {
      organizationId: event.organizationId,
      limit: GROWTH_LEARNING_OUTCOME_STORE_MAX,
    })
    await persistInsightsForOrganization(admin, {
      organizationId: event.organizationId,
      generatedAt: new Date().toISOString(),
      outcomes,
    })

    if (persisted.subject.type === "lead" && admin) {
      const revenueOutcomeTypes = new Set([
        "converted",
        "approved",
        "meeting_booked",
        "positive_intent",
      ])
      void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
        admin,
        leadId: persisted.subject.id,
        event: revenueOutcomeTypes.has(persisted.outcomeType)
          ? "revenue_outcome_recorded"
          : "learning_observation_added",
      })
    }

    return { observed: true, outcome: persisted }
  } catch {
    return { observed: false, outcome: normalized }
  }
}

export async function observeClosedLoopLearningEventForBus(event: AiOsEvent): Promise<void> {
  const admin = createServiceRoleClient()
  await observeClosedLoopLearningEvent(event, admin)
}

export function enrichRevenueDirectorWithLearningInsights(input: {
  revenueDirector: GrowthRevenueDirectorReadModel
  learning: GrowthClosedLoopLearningReadModel
}): GrowthRevenueDirectorReadModel {
  const learningAdvisory = buildGrowthLearningAdvisoryContext({ insights: input.learning.insights })
  const topInsight = learningAdvisory.topInsight

  return {
    ...input.revenueDirector,
    learningAdvisory,
    recommendations: topInsight
      ? [
          {
            id: topInsight.id,
            title: topInsight.title,
            summary: `${topInsight.summary} (advisory — no auto-change)`,
            source: "closed_loop_learning",
          },
          ...input.revenueDirector.recommendations,
        ].slice(0, 8)
      : input.revenueDirector.recommendations,
    risks:
      learningAdvisory.riskTrend === "rising"
        ? [
            {
              id: "learning-outbound-risk",
              label: "Learning: outbound risk rising",
              severity: "medium" as const,
              summary: learningAdvisory.channelTrend ?? "Negative outcome density increased.",
              mitigation: "Review Human Approval Center and bounded outbound scopes — advisory only.",
            },
            ...input.revenueDirector.risks,
          ].slice(0, 6)
        : input.revenueDirector.risks,
  }
}

export function enrichCommunicationEngineWithLearningInsights(input: {
  communicationEngine: GrowthCommunicationEngineReadModel
  learning: GrowthClosedLoopLearningReadModel
}): GrowthCommunicationEngineReadModel {
  const learningAdvisory = buildGrowthLearningCommunicationAdvisory({
    insights: input.learning.insights,
  })

  return {
    ...input.communicationEngine,
    learningAdvisory,
    summary: {
      ...input.communicationEngine.summary,
    },
  }
}

export function seedLearningOutcomeForTests(outcome: GrowthLearningOutcome): void {
  if (!useInMemoryLearningStore()) {
    process.env.GROWTH_LEARNING_IN_MEMORY_STORE = "1"
  }
  storeInMemoryOutcome(outcome)
}

export function buildLearningOutcomeFromEventId(event: AiOsEvent): GrowthLearningOutcome | null {
  return normalizeLearningOutcomeFromEvent(event)
}

export { buildLearningOutcomeId }
