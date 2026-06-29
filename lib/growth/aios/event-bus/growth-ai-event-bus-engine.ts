/** GE-AI-2B — AI Revenue OS Event Bus engine (client-safe). */

import { eventTypeMatchesPrefix, subscriptionMatchesEvent } from "@/lib/growth/aios/ai-event-registry"
import type { AiEventCategory, AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import type {
  GrowthAiEvent,
  GrowthAiEventBusHealthReadModel,
  GrowthAiEventBusSubscriberDefinition,
  GrowthAiEventBusSubscriberHealth,
  GrowthAiEventBusSubscriberId,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"
import {
  GROWTH_AI_EVENT_BUS_QA_MARKER,
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS,
  GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES,
  aiOsEventToGrowthAiEvent,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"

export const GROWTH_AI_EVENT_BUS_BRIDGE_SOURCES_WIRED = [
  "ai_work_order",
  "objective_event_router",
  "realtime_events",
] as const

export const GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS: readonly GrowthAiEventBusSubscriberDefinition[] = [
  {
    subscriberId: "meta_recommender_observer",
    categories: ["decision", "mission", "work_order", "approval", "agent", "executive"],
    eventTypePrefixes: ["decision", "mission", "work_order", "growth", "meta_recommender"],
  },
  {
    subscriberId: "priority_binding_observer",
    categories: ["decision", "mission", "work_order", "agent"],
    eventTypePrefixes: ["mission", "work_order", "growth", "priority", "meta_recommender"],
  },
  {
    subscriberId: "human_approval_center_observer",
    categories: ["approval", "decision", "work_order"],
    eventTypePrefixes: ["decision.approval", "growth.execution_plan", "work_order"],
  },
  {
    subscriberId: "ai_operations_observer",
    categories: ["agent", "executive", "health", "system", "work_order", "decision"],
    eventTypePrefixes: [],
  },
  {
    subscriberId: "revenue_director_observer",
    categories: ["executive", "mission", "decision", "approval", "agent", "objective"],
    eventTypePrefixes: ["growth", "mission", "meta_recommender", "priority", "decision", "growth.revenue_director"],
  },
  {
    subscriberId: "revenue_director_dispatch_correlation_observer",
    categories: ["agent", "system", "executive", "work_order"],
    eventTypePrefixes: [
      "growth.workflow",
      "growth.qualification",
      "growth.outreach",
      "growth.communication",
      "growth.revenue_director",
      "agent.",
    ],
  },
  {
    subscriberId: "learning_observer",
    categories: ["agent", "system", "executive", "work_order", "mission", "decision", "approval", "learning"],
    eventTypePrefixes: [
      "growth.revenue_director.workflow_request_correlation_",
      "growth.workflow",
      "growth.qualification",
      "growth.outreach",
      "growth.communication",
      "growth.autonomous_outbound",
      "growth.execution_plan",
      "decision.",
      "agent.",
      "mission.signal",
      "revenue.",
      "daily_work_queue.",
    ],
  },
  {
    subscriberId: "revenue_operator_observer",
    categories: ["agent", "system", "approval", "executive"],
    eventTypePrefixes: ["agent", "growth", "executive"],
  },
  {
    subscriberId: "agent_events_observer",
    categories: ["agent", "system", "approval", "executive"],
    eventTypePrefixes: ["agent", "growth", "executive"],
  },
  {
    subscriberId: "decision_engine_observer",
    categories: ["decision", "work_order"],
    eventTypePrefixes: ["decision", "work_order"],
  },
  {
    subscriberId: "memory_registry_observer",
    categories: ["memory"],
    eventTypePrefixes: ["memory", "context"],
  },
] as const

type SubscriberObservationStore = Map<
  GrowthAiEventBusSubscriberId,
  {
    eventsReceived: number
    eventsFailed: number
    lastEventAt: string | null
    lastEventType: string | null
    lastError: string | null
  }
>

const observationStore: SubscriberObservationStore = new Map()
let droppedEventCount = 0

function ensureObservationEntry(subscriberId: GrowthAiEventBusSubscriberId) {
  if (!observationStore.has(subscriberId)) {
    observationStore.set(subscriberId, {
      eventsReceived: 0,
      eventsFailed: 0,
      lastEventAt: null,
      lastEventType: null,
      lastError: null,
    })
  }
  return observationStore.get(subscriberId)!
}

export function resetGrowthAiEventBusObservationForTests(): void {
  observationStore.clear()
  droppedEventCount = 0
}

export function recordGrowthAiEventBusSubscriberSuccess(input: {
  subscriberId: GrowthAiEventBusSubscriberId
  event: GrowthAiEvent | AiOsEvent
}): void {
  ensureObservationEntry(input.subscriberId)
  const entry = observationStore.get(input.subscriberId)!
  const eventType = "eventType" in input.event ? input.event.eventType : input.event.eventType
  const createdAt = "createdAt" in input.event ? input.event.createdAt : input.event.occurredAt
  entry.eventsReceived += 1
  entry.lastEventAt = createdAt
  entry.lastEventType = eventType
  entry.lastError = null
}

export function recordGrowthAiEventBusSubscriberFailure(input: {
  subscriberId: GrowthAiEventBusSubscriberId
  error: string
}): void {
  ensureObservationEntry(input.subscriberId)
  const entry = observationStore.get(input.subscriberId)!
  entry.eventsFailed += 1
  entry.lastError = input.error
}

export function recordGrowthAiEventBusDroppedEvent(): void {
  droppedEventCount += 1
}

export function growthAiEventBusSubscriberObservesEvent(
  subscriberId: GrowthAiEventBusSubscriberId,
  event: AiOsEvent,
): boolean {
  const definition = GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.find(
    (row) => row.subscriberId === subscriberId,
  )
  if (!definition) return false
  return subscriptionMatchesEvent(definition, {
    category: event.category,
    eventType: event.eventType,
  })
}

export function resolveWorkflowLifecycleAlias(eventType: string): string | null {
  return GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES[eventType] ?? null
}

export function normalizeWorkflowAgentEventMetadata(event: AiOsEvent): Record<string, unknown> {
  const alias = resolveWorkflowLifecycleAlias(event.eventType)
  const workflowAgent =
    typeof event.payload.agent_kind === "string"
      ? event.payload.agent_kind
      : event.agentOwner ?? event.producer

  return {
    lifecycle_alias: alias,
    workflow_agent: workflowAgent,
    correlation_id: event.correlationId,
    trace_id: typeof event.metadata.trace_id === "string" ? event.metadata.trace_id : event.correlationId,
  }
}

export function getGrowthAiEventBusSubscriberObservation(
  subscriberId: GrowthAiEventBusSubscriberId,
): { eventsReceived: number; lastEventType: string | null } | null {
  const entry = observationStore.get(subscriberId)
  if (!entry) return null
  return {
    eventsReceived: entry.eventsReceived,
    lastEventType: entry.lastEventType,
  }
}

export function buildGrowthAiEventBusSubscriberHealth(): GrowthAiEventBusSubscriberHealth[] {
  return GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS.map((subscriberId) => {
    const entry = observationStore.get(subscriberId)
    const definition = GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.find(
      (row) => row.subscriberId === subscriberId,
    )
    return {
      subscriberId,
      enabled: Boolean(definition) || subscriberId === "executive_brain",
      eventsReceived: entry?.eventsReceived ?? 0,
      eventsFailed: entry?.eventsFailed ?? 0,
      lastEventAt: entry?.lastEventAt ?? null,
      lastEventType: entry?.lastEventType ?? null,
      lastError: entry?.lastError ?? null,
    }
  })
}

export function synthesizeGrowthAiEventBusHealthReadModel(input: {
  generatedAt: string
  recentEvents: AiOsEvent[]
}): GrowthAiEventBusHealthReadModel {
  const last = input.recentEvents[0] ?? null
  return {
    readOnly: true,
    qaMarker: GROWTH_AI_EVENT_BUS_QA_MARKER,
    generatedAt: input.generatedAt,
    recentEventCount: input.recentEvents.length,
    lastEventAt: last?.occurredAt ?? last?.createdAt ?? null,
    lastEventType: last?.eventType ?? null,
    registeredSubscribers: GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.length + 1,
    subscriberHealth: buildGrowthAiEventBusSubscriberHealth(),
    droppedEvents: droppedEventCount,
    bridgeSourcesWired: [...GROWTH_AI_EVENT_BUS_BRIDGE_SOURCES_WIRED],
  }
}

export function mapGrowthAiEventBusSubscriberToAiOsCategories(
  subscriberId: GrowthAiEventBusSubscriberId,
): AiEventCategory[] {
  const definition = GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.find(
    (row) => row.subscriberId === subscriberId,
  )
  return definition?.categories ?? []
}

export function mapGrowthAiEventBusSubscriberToPrefixes(
  subscriberId: GrowthAiEventBusSubscriberId,
): string[] {
  const definition = GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS.find(
    (row) => row.subscriberId === subscriberId,
  )
  return definition?.eventTypePrefixes ?? []
}

export function growthAiEventFromAiOs(event: AiOsEvent): GrowthAiEvent {
  return aiOsEventToGrowthAiEvent(event)
}

export function eventMatchesGrowthSubscriberPrefix(eventType: string, prefixes: string[]): boolean {
  if (prefixes.length === 0) return true
  return prefixes.some((prefix) => eventTypeMatchesPrefix(eventType, prefix))
}
