/** GE-AI-2B — AI Revenue OS Event Bus service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  bridgeLegacyEventToAiOs,
  buildAiOsEventFromObjectiveSource,
  buildAiOsEventFromRealtimeEnvelope,
  buildAiOsEventFromWorkOrderAudit,
} from "@/lib/growth/aios/ai-event-bridge"
import { listAiOsEvents } from "@/lib/growth/aios/ai-event-repository"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import type { AiWorkOrder, AiWorkOrderEvent } from "@/lib/growth/aios/ai-work-order-types"
import {
  ensureGrowthAiEventBusDbSubscriptions,
  ensureGrowthAiEventBusInProcessSubscribers,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
import {
  normalizeWorkflowAgentEventMetadata,
  synthesizeGrowthAiEventBusHealthReadModel,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import type {
  GrowthAiEvent,
  GrowthAiEventBusHealthReadModel,
  GrowthAiEventBusPublishResult,
  GrowthAiEventPublishInput,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"
import {
  aiOsEventToGrowthAiEvent,
  growthAiEventToAiOsPublishInput,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"
import type { GrowthObjectiveSourceEvent } from "@/lib/growth/objectives/growth-objective-signal-mapper"

let subscribersInitialized = false

function ensureSubscribersOnce(): void {
  if (subscribersInitialized) return
  ensureGrowthAiEventBusInProcessSubscribers()
  subscribersInitialized = true
}

export async function publishGrowthAiEvent(
  admin: SupabaseClient,
  input: GrowthAiEventPublishInput,
): Promise<GrowthAiEventBusPublishResult> {
  ensureSubscribersOnce()

  const publishInput = growthAiEventToAiOsPublishInput(input)
  const result = await publishAiOsEvent(admin, publishInput)

  return {
    event: aiOsEventToGrowthAiEvent(result.event),
    aiOsEvent: result.event,
    deliveriesCreated: result.deliveriesCreated,
    handlersInvoked: result.handlersInvoked,
    handlerFailures: result.handlerFailures,
  }
}

export async function bridgeAiWorkOrderAuditToEventBus(
  admin: SupabaseClient,
  input: {
    workOrder: AiWorkOrder
    workOrderEvent: AiWorkOrderEvent
  },
): Promise<{ bridged: boolean; event?: AiOsEvent }> {
  ensureSubscribersOnce()

  const bridgeInput = buildAiOsEventFromWorkOrderAudit({
    organizationId: input.workOrder.organizationId,
    missionId: input.workOrder.missionId,
    workOrderId: input.workOrder.id,
    ownerAgent: input.workOrder.ownerAgent,
    workOrderEvent: input.workOrderEvent,
  })

  const result = await bridgeLegacyEventToAiOs(admin, bridgeInput)
  return { bridged: true, event: result.event }
}

export async function bridgeObjectiveSourceToEventBus(
  admin: SupabaseClient,
  input: {
    event: GrowthObjectiveSourceEvent
    legacyEventId: string
  },
): Promise<{ bridged: boolean; event?: AiOsEvent }> {
  ensureSubscribersOnce()

  const bridgeInput = buildAiOsEventFromObjectiveSource({
    organizationId: input.event.organizationId,
    legacyEventId: input.legacyEventId,
    signalType: input.event.signalType,
    leadId: input.event.leadId,
    occurredAt: input.event.occurredAt,
  })

  const result = await bridgeLegacyEventToAiOs(admin, bridgeInput)
  return { bridged: true, event: result.event }
}

export async function bridgeRealtimeEnvelopeToEventBus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    legacyEventId: string
    logicalEventType: string
    leadId?: string | null
    payload?: Record<string, unknown>
  },
): Promise<{ bridged: boolean; event?: AiOsEvent }> {
  ensureSubscribersOnce()

  const bridgeInput = buildAiOsEventFromRealtimeEnvelope(input)
  const result = await bridgeLegacyEventToAiOs(admin, bridgeInput)
  return { bridged: true, event: result.event }
}

export async function ensureGrowthAiEventBusForOrganization(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<void> {
  ensureSubscribersOnce()
  await ensureGrowthAiEventBusDbSubscriptions(admin, input)
}

export async function fetchGrowthAiEventBusHealthReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt: string; recentLimit?: number },
): Promise<GrowthAiEventBusHealthReadModel> {
  ensureSubscribersOnce()

  const recentEvents = await listAiOsEvents(admin, {
    organizationId: input.organizationId,
    limit: input.recentLimit ?? 50,
  })

  return synthesizeGrowthAiEventBusHealthReadModel({
    generatedAt: input.generatedAt,
    recentEvents,
  })
}

export function toGrowthAiEvent(event: AiOsEvent): GrowthAiEvent {
  return aiOsEventToGrowthAiEvent(event)
}

export function enrichAiOsEventWithWorkflowMetadata(event: AiOsEvent): Record<string, unknown> {
  return normalizeWorkflowAgentEventMetadata(event)
}

export { ensureGrowthAiEventBusInProcessSubscribers } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-subscriber-registry"
