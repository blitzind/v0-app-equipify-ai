/** GE-AIOS-2B — Legacy Growth event bridges into AI OS events (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiWorkOrderEvent } from "@/lib/growth/aios/ai-work-order-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import type { AiOsEvent, AiOsLegacyBridgeSource } from "@/lib/growth/aios/ai-event-types"

export type BridgeLegacyAiOsEventInput = {
  organizationId: string
  bridgeSource: AiOsLegacyBridgeSource
  legacyEventId: string
  eventType: string
  category: AiOsEvent["category"]
  producer: string
  correlationId?: string
  missionId?: string | null
  workOrderId?: string | null
  agentOwner?: AiOsEvent["agentOwner"]
  entityType?: string | null
  entityId?: string | null
  priority?: number
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  replayKey?: string | null
}

export async function bridgeLegacyEventToAiOs(
  admin: SupabaseClient,
  input: BridgeLegacyAiOsEventInput,
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[] }> {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: input.category,
    producer: input.producer,
    source: `bridge:${input.bridgeSource}`,
    correlationId: input.correlationId,
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    agentOwner: input.agentOwner,
    entityType: input.entityType,
    entityId: input.entityId,
    priority: input.priority,
    payload: input.payload ?? {},
    metadata: {
      ...(input.metadata ?? {}),
      bridge_source: input.bridgeSource,
      legacy_event_id: input.legacyEventId,
    },
    replayKey: input.replayKey,
    auditMetadata: {
      bridged: true,
      bridge_source: input.bridgeSource,
    },
  })
}

export function buildAiOsEventFromWorkOrderAudit(input: {
  organizationId: string
  missionId: string
  workOrderId: string
  ownerAgent: AiOsEvent["agentOwner"]
  workOrderEvent: AiWorkOrderEvent
}): BridgeLegacyAiOsEventInput {
  const eventType =
    input.workOrderEvent.eventType === "work_order.status_changed"
      ? "work_order.status_changed"
      : input.workOrderEvent.eventType

  return {
    organizationId: input.organizationId,
    bridgeSource: "ai_work_order",
    legacyEventId: input.workOrderEvent.id,
    eventType,
    category: "work_order",
    producer: "ai_work_order_service",
    correlationId: input.workOrderId,
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    agentOwner: input.ownerAgent,
    payload: {
      title: input.workOrderEvent.title,
      description: input.workOrderEvent.description,
      from_status: input.workOrderEvent.fromStatus,
      to_status: input.workOrderEvent.toStatus,
    },
    metadata: input.workOrderEvent.metadata,
    replayKey: `bridge:ai_work_order:${input.workOrderEvent.id}`,
  }
}

export function buildAiOsEventFromObjectiveSource(input: {
  organizationId: string
  legacyEventId: string
  signalType: string
  leadId?: string | null
  occurredAt?: string | null
}): BridgeLegacyAiOsEventInput {
  return {
    organizationId: input.organizationId,
    bridgeSource: "objective_event_router",
    legacyEventId: input.legacyEventId,
    eventType: `mission.signal.${input.signalType}`,
    category: "mission",
    producer: "growth_objective_event_router",
    correlationId: input.leadId ?? input.legacyEventId,
    entityType: input.leadId ? "lead" : null,
    entityId: input.leadId ?? null,
    payload: { signal_type: input.signalType, occurred_at: input.occurredAt ?? null },
    replayKey: `bridge:objective:${input.legacyEventId}`,
  }
}

export function buildAiOsEventFromRealtimeEnvelope(input: {
  organizationId: string
  legacyEventId: string
  logicalEventType: string
  leadId?: string | null
  payload?: Record<string, unknown>
}): BridgeLegacyAiOsEventInput {
  return {
    organizationId: input.organizationId,
    bridgeSource: "realtime_events",
    legacyEventId: input.legacyEventId,
    eventType: input.logicalEventType,
    category: "system",
    producer: "growth_realtime_events",
    correlationId: input.leadId ?? input.legacyEventId,
    entityType: input.leadId ? "lead" : null,
    entityId: input.leadId ?? null,
    payload: input.payload ?? {},
    replayKey: `bridge:realtime:${input.legacyEventId}`,
  }
}
