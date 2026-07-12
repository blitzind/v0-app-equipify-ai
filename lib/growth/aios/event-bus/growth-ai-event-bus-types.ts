/** GE-AI-2B — AI Revenue OS Event Bus completion types (client-safe). */

import type { AiEventCategory, AiOsEvent, AiOsEventPublishInput } from "@/lib/growth/aios/ai-event-types"

export const GROWTH_AIOS_GE_AI_2B_PHASE = "GE-AI-2B" as const

export const GROWTH_AI_EVENT_BUS_QA_MARKER = "growth-ge-ai-2b-event-bus-completion-v1" as const

export const GROWTH_AI_EVENT_BUS_RULE =
  "Workflow Agents publish canonical AI OS events; intelligence layers subscribe without direct agent coupling — no duplicate event systems, no outbound execution." as const

/** Canonical envelope category — maps from constitutional AiEventCategory. */
export const GROWTH_AI_EVENT_CATEGORIES = [
  "workflow",
  "recommendation",
  "priority",
  "approval",
  "communication",
  "objective",
  "mission",
  "operator",
  "system",
] as const

export type GrowthAiEventCategory = (typeof GROWTH_AI_EVENT_CATEGORIES)[number]

export const GROWTH_AI_EVENT_ENTITY_TYPES = [
  "lead",
  "company",
  "person",
  "mission",
  "objective",
  "campaign",
  "sequence",
  "meeting",
  "call",
  "customer",
  "system",
] as const

export type GrowthAiEventEntityType = (typeof GROWTH_AI_EVENT_ENTITY_TYPES)[number]

export const GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS = [
  "meta_recommender_observer",
  "priority_binding_observer",
  "human_approval_center_observer",
  "ai_operations_observer",
  "revenue_operator_observer",
  "revenue_director_observer",
  "revenue_director_dispatch_correlation_observer",
  "learning_observer",
  "executive_brain",
  "decision_engine_observer",
  "memory_registry_observer",
  "agent_events_observer",
  "draft_factory_wake_observer",
] as const

export type GrowthAiEventBusSubscriberId = (typeof GROWTH_AI_EVENT_BUS_SUBSCRIBER_IDS)[number]

export type GrowthAiEventMetadata = {
  workflowAgent?: string
  recommendationId?: string
  priorityBindingId?: string
  approvalItemId?: string
  correlationId?: string
  traceId?: string
  bridgeSource?: string
  legacyEventId?: string
}

/** Canonical envelope — projection of AiOsEvent for cross-layer communication. */
export type GrowthAiEvent = {
  id: string
  organizationId: string
  category: GrowthAiEventCategory
  eventType: string
  entityType: GrowthAiEventEntityType | string | null
  entityId: string | null
  producer: string
  payload: Record<string, unknown>
  metadata: GrowthAiEventMetadata
  createdAt: string
  /** Underlying AI OS substrate fields (backward compatible). */
  aiOs: {
    category: AiEventCategory
    correlationId: string
    causationId: string | null
    missionId: string | null
    workOrderId: string | null
    eventVersion: number
    schemaVersion: string
    source: string
    replayKey: string | null
  }
}

export type GrowthAiEventPublishInput = {
  organizationId: string
  eventType: string
  category?: GrowthAiEventCategory
  aiOsCategory?: AiEventCategory
  producer: string
  source: string
  entityType?: GrowthAiEventEntityType | string | null
  entityId?: string | null
  correlationId?: string
  causationId?: string | null
  missionId?: string | null
  workOrderId?: string | null
  payload?: Record<string, unknown>
  metadata?: GrowthAiEventMetadata
  replayKey?: string | null
  occurredAt?: string
}

export type GrowthAiEventBusSubscriberHealth = {
  subscriberId: GrowthAiEventBusSubscriberId
  enabled: boolean
  eventsReceived: number
  eventsFailed: number
  lastEventAt: string | null
  lastEventType: string | null
  lastError: string | null
}

export type GrowthAiEventBusHealthReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_EVENT_BUS_QA_MARKER
  generatedAt: string
  recentEventCount: number
  lastEventAt: string | null
  lastEventType: string | null
  registeredSubscribers: number
  subscriberHealth: GrowthAiEventBusSubscriberHealth[]
  droppedEvents: number
  bridgeSourcesWired: string[]
}

export type GrowthAiEventBusPublishResult = {
  event: GrowthAiEvent
  aiOsEvent: AiOsEvent
  deliveriesCreated: number
  handlersInvoked: string[]
  handlerFailures: string[]
}

export type GrowthAiEventBusSubscriberDefinition = {
  subscriberId: GrowthAiEventBusSubscriberId
  categories: AiEventCategory[]
  eventTypePrefixes: string[]
  bridgeSources?: string[]
}

/** Lifecycle aliases — normalize workflow agent events without duplicate emission. */
export const GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES: Record<string, string> = {
  "agent.wake": "ResearchStarted",
  "growth.workflow.status_changed": "ResearchCompleted",
  "growth.qualification.completed": "QualificationCompleted",
  "growth.execution_plan.generated": "PlanningCompleted",
  "growth.execution.enqueued": "ExecutionPrepared",
  "growth.outreach.prepared": "OutreachPrepared",
  "growth.meeting.prepared": "MeetingPrepared",
  "growth.execution_plan.review_changed": "ApprovalRequested",
  "decision.approval_required": "ApprovalRequested",
  "decision.gate_passed": "ApprovalGranted",
  "decision.gate_blocked": "ApprovalRejected",
  "mission.completed": "MissionCompleted",
  "mission.signal.objective_advanced": "ObjectiveAdvanced",
  "growth.company_intelligence.completed": "CompanyIntelligenceCompleted",
  "growth.datamoon.person_requested": "DataMoonPersonRequested",
  "growth.datamoon.person_pending": "DataMoonPersonPending",
  "growth.datamoon.person_completed": "DataMoonPersonCompleted",
  "growth.datamoon.person_failed": "DataMoonPersonFailed",
  "growth.contact.verified": "ContactVerified",
  "growth.contact.available": "ContactAvailable",
  "growth.contact.verification_failed": "ContactVerificationFailed",
  "growth.personalization.completed": "PersonalizationCompleted",
  "growth.mission.changed": "MissionChanged",
  "growth.company.profile_changed": "CompanyProfileChanged",
  "growth.capacity.available": "CapacityAvailable",
  "growth.research.became_stale": "ResearchBecameStale",
  "growth.budget.window_reset": "BudgetWindowReset",
}

export function mapAiEventCategoryToGrowthCategory(category: AiEventCategory): GrowthAiEventCategory {
  switch (category) {
    case "work_order":
      return "workflow"
    case "decision":
      return "recommendation"
    case "approval":
      return "approval"
    case "mission":
      return "mission"
    case "agent":
    case "executive":
      return "operator"
    case "conversation":
      return "communication"
    case "opportunity":
      return "objective"
    default:
      return "system"
  }
}

export function mapGrowthCategoryToAiEventCategory(
  category: GrowthAiEventCategory,
  eventType: string,
): AiEventCategory {
  if (lookupAiOsCategoryOverride(eventType)) return lookupAiOsCategoryOverride(eventType)!
  switch (category) {
    case "workflow":
      return "work_order"
    case "recommendation":
      return "decision"
    case "approval":
      return "approval"
    case "mission":
      return "mission"
    case "operator":
      return "agent"
    case "communication":
      return "conversation"
    case "objective":
      return "opportunity"
    case "priority":
      return "decision"
    default:
      return "system"
  }
}

function lookupAiOsCategoryOverride(eventType: string): AiEventCategory | null {
  if (eventType.startsWith("growth.")) return "system"
  if (eventType.startsWith("meta_recommender.")) return "decision"
  if (eventType.startsWith("priority.")) return "decision"
  if (eventType.startsWith("mission.signal.")) return "mission"
  return null
}

export function growthAiEventToAiOsPublishInput(input: GrowthAiEventPublishInput): AiOsEventPublishInput {
  const aiOsCategory =
    input.aiOsCategory ??
    (input.category ? mapGrowthCategoryToAiEventCategory(input.category, input.eventType) : undefined)

  return {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: aiOsCategory ?? "system",
    producer: input.producer,
    source: input.source,
    correlationId: input.correlationId ?? input.metadata?.correlationId,
    causationId: input.causationId,
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload ?? {},
    metadata: {
      ...(input.metadata ?? {}),
      growth_ai_event_category: input.category ?? null,
      lifecycle_alias: GROWTH_AI_WORKFLOW_LIFECYCLE_ALIASES[input.eventType] ?? null,
      trace_id: input.metadata?.traceId ?? input.correlationId ?? null,
    },
    replayKey: input.replayKey,
    occurredAt: input.occurredAt,
  }
}

export function aiOsEventToGrowthAiEvent(event: AiOsEvent): GrowthAiEvent {
  const growthCategory =
    (typeof event.metadata.growth_ai_event_category === "string"
      ? event.metadata.growth_ai_event_category
      : null) ?? mapAiEventCategoryToGrowthCategory(event.category)

  const traceId =
    (typeof event.metadata.trace_id === "string" ? event.metadata.trace_id : null) ??
    event.correlationId

  return {
    id: event.id,
    organizationId: event.organizationId,
    category: growthCategory as GrowthAiEventCategory,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    producer: event.producer,
    payload: event.payload,
    metadata: {
      workflowAgent: typeof event.metadata.workflow_agent === "string" ? event.metadata.workflow_agent : event.agentOwner ?? undefined,
      recommendationId: typeof event.metadata.recommendation_id === "string" ? event.metadata.recommendation_id : undefined,
      priorityBindingId: typeof event.metadata.priority_binding_id === "string" ? event.metadata.priority_binding_id : undefined,
      approvalItemId: typeof event.metadata.approval_item_id === "string" ? event.metadata.approval_item_id : undefined,
      correlationId: event.correlationId,
      traceId,
      bridgeSource: typeof event.metadata.bridge_source === "string" ? event.metadata.bridge_source : undefined,
      legacyEventId: typeof event.metadata.legacy_event_id === "string" ? event.metadata.legacy_event_id : undefined,
    },
    createdAt: event.occurredAt ?? event.createdAt,
    aiOs: {
      category: event.category,
      correlationId: event.correlationId,
      causationId: event.causationId,
      missionId: event.missionId,
      workOrderId: event.workOrderId,
      eventVersion: event.eventVersion,
      schemaVersion: event.schemaVersion,
      source: event.source,
      replayKey: event.replayKey,
    },
  }
}
