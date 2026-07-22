/** GE-AIOS-2B — AI OS Event service (server-only, infrastructure only). */

import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  appendAiOsEventArchiveRecord,
  fetchAiOsEventById,
  insertAiOsEvent,
  insertAiOsEventDeliveries,
  listAiOsEventSubscriptions,
  listAiOsEvents,
  listPendingAiOsEventDeliveries,
  markAiOsEventDeliveryConsumed,
  replayAiOsEvents,
  upsertAiOsEventSubscription,
} from "@/lib/growth/aios/ai-event-repository"
import { lookupAiEventRegistryEntry, subscriptionMatchesEvent } from "@/lib/growth/aios/ai-event-registry"
import { invokeRegisteredAiOsEventHandlers } from "@/lib/growth/aios/ai-event-subscriber-registry"
import { persistAiOsEventHandlerTelemetry } from "@/lib/growth/draft-factory/draft-factory-wake-observability-repository"
import { resolveGrowthRuntimeInstanceId } from "@/lib/growth/draft-factory/draft-factory-wake-observability-runtime"
import type {
  AiOsEvent,
  AiOsEventListFilter,
  AiOsEventPublishInput,
  AiOsEventReplayFilter,
  AiOsEventSubscription,
  AiOsEventSubscriptionInput,
} from "@/lib/growth/aios/ai-event-types"

export async function publishAiOsEvent(
  admin: SupabaseClient,
  input: AiOsEventPublishInput,
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[]; handlerFailures: string[] }> {
  const registry = lookupAiEventRegistryEntry(input.eventType)
  const category = input.category ?? registry?.category
  if (!category) throw new Error("ai_event_category_required")

  const correlationId = input.correlationId ?? randomUUID()
  const event = await insertAiOsEvent(admin, {
    ...input,
    category,
    correlationId,
    eventVersion: input.eventVersion ?? registry?.eventVersion ?? 1,
    schemaVersion: input.schemaVersion ?? registry?.schemaVersion ?? "1.0",
    lifecycle: "published",
  })

  const subscriptions = await listAiOsEventSubscriptions(admin, {
    organizationId: input.organizationId,
    enabledOnly: true,
  })
  const matched = subscriptions.filter((subscription) =>
    subscriptionMatchesEvent(subscription, { category: event.category, eventType: event.eventType }),
  )

  const deliveries = await insertAiOsEventDeliveries(
    admin,
    matched.map((subscription) => ({
      eventId: event.id,
      organizationId: event.organizationId,
      subscriptionId: subscription.id,
      subscriberId: subscription.subscriberId,
    })),
  )

  const handlerRun = await invokeRegisteredAiOsEventHandlers(event)
  const handlersInvoked = handlerRun.invoked
  const handlerFailures = handlerRun.failures

  await persistAiOsEventHandlerTelemetry(admin, {
    eventId: event.id,
    organizationId: event.organizationId,
    handlersDiscovered: handlerRun.discovered,
    handlersInvoked: handlerRun.invoked,
    handlersSkipped: handlerRun.skipped,
    handlerFailures: handlerRun.runs
      .filter((row) => row.status === "failed")
      .map((row) => ({ subscriberId: row.subscriberId, errorMessage: row.errorMessage })),
    runtimeInstance: resolveGrowthRuntimeInstanceId(),
  }).catch(() => undefined)

  return {
    event,
    deliveriesCreated: deliveries.length,
    handlersInvoked,
    handlerFailures,
  }
}

export async function publishAiOsEventCorrection(
  admin: SupabaseClient,
  input: AiOsEventPublishInput & { causationId: string; originalEventId: string },
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[]; handlerFailures: string[] }> {
  const original = await fetchAiOsEventById(admin, {
    organizationId: input.organizationId,
    eventId: input.originalEventId,
  })
  if (!original) throw new Error("ai_event_original_not_found")

  return publishAiOsEvent(admin, {
    ...input,
    eventType: input.eventType || "ai_os.event.correction",
    category: input.category ?? "system",
    causationId: input.causationId,
    correlationId: input.correlationId ?? original.correlationId,
    metadata: {
      ...(input.metadata ?? {}),
      corrects_event_id: original.id,
      correction: true,
    },
  })
}

export async function registerAiOsEventSubscription(
  admin: SupabaseClient,
  input: AiOsEventSubscriptionInput,
): Promise<AiOsEventSubscription> {
  return upsertAiOsEventSubscription(admin, input)
}

export async function getAiOsEvent(
  admin: SupabaseClient,
  input: { organizationId: string; eventId: string },
): Promise<AiOsEvent | null> {
  return fetchAiOsEventById(admin, input)
}

export async function queryAiOsEvents(
  admin: SupabaseClient,
  filter: AiOsEventListFilter,
): Promise<AiOsEvent[]> {
  return listAiOsEvents(admin, filter)
}

export async function replayAiOsEventStream(
  admin: SupabaseClient,
  filter: AiOsEventReplayFilter,
): Promise<AiOsEvent[]> {
  return replayAiOsEvents(admin, filter)
}

export async function pullAiOsEventsForSubscriber(
  admin: SupabaseClient,
  input: { organizationId: string; subscriberId: string; limit?: number },
): Promise<Array<{ deliveryId: string; event: AiOsEvent }>> {
  const pending = await listPendingAiOsEventDeliveries(admin, input)
  const results: Array<{ deliveryId: string; event: AiOsEvent }> = []

  for (const delivery of pending) {
    const event = await fetchAiOsEventById(admin, {
      organizationId: input.organizationId,
      eventId: delivery.eventId,
    })
    if (event) results.push({ deliveryId: delivery.id, event })
  }

  return results
}

export async function consumeAiOsEventDelivery(
  admin: SupabaseClient,
  input: {
    organizationId: string
    deliveryId: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await markAiOsEventDeliveryConsumed(admin, input)
}

export async function archiveAiOsEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventId: string
    reason?: string
    archivedBy?: string | null
  },
): Promise<void> {
  const event = await fetchAiOsEventById(admin, {
    organizationId: input.organizationId,
    eventId: input.eventId,
  })
  if (!event) throw new Error("ai_event_not_found")

  await appendAiOsEventArchiveRecord(admin, {
    eventId: event.id,
    organizationId: event.organizationId,
    reason: input.reason,
    archivedBy: input.archivedBy,
    metadata: { lifecycle: "archived" },
  })
}
