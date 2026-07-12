/** GE-AI-2B — AI Revenue OS Event Bus subscriber registry (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID } from "@/lib/growth/aios/ai-executive-brain-types"
import { registerAiOsEventHandler } from "@/lib/growth/aios/ai-event-subscriber-registry"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import {
  GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS,
  growthAiEventBusSubscriberObservesEvent,
  recordGrowthAiEventBusSubscriberFailure,
  recordGrowthAiEventBusSubscriberSuccess,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-engine"
import {
  GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types"
import { observeRevenueDirectorDispatchCorrelationEvent } from "@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-service"
import {
  GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import { observeClosedLoopLearningEventForBus } from "@/lib/growth/aios/learning/growth-closed-loop-learning-service"
import { observeDraftFactoryWakeEventForBus } from "@/lib/growth/draft-factory/draft-factory-wake-bus-observer"
import { GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import {
  aiOsEventToGrowthAiEvent,
  type GrowthAiEventBusSubscriberId,
} from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"

const unregisterCallbacks = new Map<GrowthAiEventBusSubscriberId, () => void>()
let subscribersEnsured = false

async function runSubscriberObservation(
  subscriberId: GrowthAiEventBusSubscriberId,
  event: AiOsEvent,
): Promise<void> {
  if (!growthAiEventBusSubscriberObservesEvent(subscriberId, event)) return

  if (subscriberId === GROWTH_REVENUE_DIRECTOR_DISPATCH_CORRELATION_SUBSCRIBER_ID) {
    await observeRevenueDirectorDispatchCorrelationEvent(event)
  }

  if (subscriberId === GROWTH_CLOSED_LOOP_LEARNING_SUBSCRIBER_ID) {
    await observeClosedLoopLearningEventForBus(event)
  }

  if (subscriberId === GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID) {
    await observeDraftFactoryWakeEventForBus(event)
  }

  const growthEvent = aiOsEventToGrowthAiEvent(event)
  recordGrowthAiEventBusSubscriberSuccess({ subscriberId, event: growthEvent })
}

function wrapSubscriberHandler(subscriberId: GrowthAiEventBusSubscriberId) {
  return async (event: AiOsEvent) => {
    try {
      await runSubscriberObservation(subscriberId, event)
    } catch (error) {
      recordGrowthAiEventBusSubscriberFailure({
        subscriberId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function ensureGrowthAiEventBusInProcessSubscribers(): void {
  if (subscribersEnsured) return

  for (const definition of GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS) {
    if (unregisterCallbacks.has(definition.subscriberId)) continue
    const unregister = registerAiOsEventHandler({
      subscriberId: definition.subscriberId,
      handler: wrapSubscriberHandler(definition.subscriberId),
    })
    unregisterCallbacks.set(definition.subscriberId, unregister)
  }

  subscribersEnsured = true
}

export async function ensureGrowthAiEventBusDbSubscriptions(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<void> {
  const { registerAiOsEventSubscription } = await import("@/lib/growth/aios/ai-event-service")

  for (const definition of GROWTH_AI_EVENT_BUS_SUBSCRIBER_DEFINITIONS) {
    await registerAiOsEventSubscription(admin, {
      organizationId: input.organizationId,
      subscriberId: definition.subscriberId,
      subscriberKind: "internal",
      categories: definition.categories,
      eventTypePrefixes: definition.eventTypePrefixes,
      enabled: true,
      metadata: {
        ge_ai_2b_completion: true,
        observer_only: true,
      },
    })
  }

  await registerAiOsEventSubscription(admin, {
    organizationId: input.organizationId,
    subscriberId: AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
    subscriberKind: "internal",
    categories: ["mission", "work_order", "decision", "executive", "agent"],
    eventTypePrefixes: ["mission", "work_order", "decision", "executive", "agent"],
    enabled: true,
    metadata: { ge_ai_2b_completion: true },
  })
}

export function clearGrowthAiEventBusSubscribersForTests(): void {
  for (const unregister of unregisterCallbacks.values()) {
    unregister()
  }
  unregisterCallbacks.clear()
  subscribersEnsured = false
}

export function listGrowthAiEventBusRegisteredSubscribers(): GrowthAiEventBusSubscriberId[] {
  return [...unregisterCallbacks.keys()]
}
