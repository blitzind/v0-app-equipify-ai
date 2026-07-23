/** GE-AIOS-2B — AI OS Event service (server-only). Delegates to @fuzor/event-bus. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  archivePlatformEvent,
  consumePlatformEventDelivery,
  getPlatformEvent,
  publishPlatformEvent,
  publishPlatformEventCorrection,
  pullPlatformEventsForSubscriber,
  queryPlatformEvents,
  registerPlatformEventSubscription,
  replayPlatformEventStream,
} from "@fuzor/event-bus"
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

async function publishWithHandlerTelemetry(
  admin: SupabaseClient,
  publish: () => ReturnType<typeof publishPlatformEvent>,
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[]; handlerFailures: string[] }> {
  const result = await publish()

  await persistAiOsEventHandlerTelemetry(admin, {
    eventId: result.event.id,
    organizationId: result.event.organizationId,
    handlersDiscovered: result.handlerRun.discovered,
    handlersInvoked: result.handlerRun.invoked,
    handlersSkipped: result.handlerRun.skipped,
    handlerFailures: result.handlerRun.runs
      .filter((row) => row.status === "failed")
      .map((row) => ({ subscriberId: row.subscriberId, errorMessage: row.errorMessage })),
    runtimeInstance: resolveGrowthRuntimeInstanceId(),
  }).catch(() => undefined)

  return {
    event: result.event,
    deliveriesCreated: result.deliveriesCreated,
    handlersInvoked: result.handlersInvoked,
    handlerFailures: result.handlerFailures,
  }
}

export async function publishAiOsEvent(
  admin: SupabaseClient,
  input: AiOsEventPublishInput,
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[]; handlerFailures: string[] }> {
  return publishWithHandlerTelemetry(admin, () => publishPlatformEvent(admin, input))
}

export async function publishAiOsEventCorrection(
  admin: SupabaseClient,
  input: AiOsEventPublishInput & { causationId: string; originalEventId: string },
): Promise<{ event: AiOsEvent; deliveriesCreated: number; handlersInvoked: string[]; handlerFailures: string[] }> {
  return publishWithHandlerTelemetry(admin, () => publishPlatformEventCorrection(admin, input))
}

export {
  archivePlatformEvent as archiveAiOsEvent,
  consumePlatformEventDelivery as consumeAiOsEventDelivery,
  getPlatformEvent as getAiOsEvent,
  pullPlatformEventsForSubscriber as pullAiOsEventsForSubscriber,
  queryPlatformEvents as queryAiOsEvents,
  registerPlatformEventSubscription as registerAiOsEventSubscription,
  replayPlatformEventStream as replayAiOsEventStream,
}

export type {
  PlatformEvent as AiOsEvent,
  PlatformEventListFilter as AiOsEventListFilter,
  PlatformEventPublishInput as AiOsEventPublishInput,
  PlatformEventReplayFilter as AiOsEventReplayFilter,
  PlatformEventSubscription as AiOsEventSubscription,
  PlatformEventSubscriptionInput as AiOsEventSubscriptionInput,
} from "@fuzor/event-bus"
