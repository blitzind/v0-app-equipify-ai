/** GE-AIOS-2G — Executive Brain event observation handler (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES,
  AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
} from "@/lib/growth/aios/ai-executive-brain-types"
import { insertAiExecutiveEventObservation } from "@/lib/growth/aios/ai-executive-brain-repository"
import { eventTypeMatchesPrefix } from "@/lib/growth/aios/ai-event-registry"
import { registerAiOsEventHandler } from "@/lib/growth/aios/ai-event-subscriber-registry"
import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"

const observedCategories = new Set<string>(AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES)

let unregisterHandler: (() => void) | null = null

function executiveObservesEvent(event: AiOsEvent): boolean {
  if (!observedCategories.has(event.category)) return false
  return AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES.some((prefix) =>
    eventTypeMatchesPrefix(event.eventType, prefix.replace(".", "")),
  )
}

export function ensureExecutiveBrainEventHandlerRegistered(
  admin: SupabaseClient,
  input: { organizationId: string; executiveRuntimeId: string },
): () => void {
  if (unregisterHandler) return unregisterHandler

  unregisterHandler = registerAiOsEventHandler({
    subscriberId: AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID,
    handler: async (event: AiOsEvent) => {
      if (event.organizationId !== input.organizationId) return
      if (!executiveObservesEvent(event)) return

      await insertAiExecutiveEventObservation(admin, {
        organizationId: event.organizationId,
        executiveRuntimeId: input.executiveRuntimeId,
        eventId: event.id,
        eventCategory: event.category,
        eventType: event.eventType,
        missionId: event.missionId,
        workOrderId: event.workOrderId,
        metadata: {
          correlation_id: event.correlationId,
          producer: event.producer,
        },
      })
    },
  })

  return unregisterHandler
}

export function clearExecutiveBrainEventHandlerForTests(): void {
  unregisterHandler?.()
  unregisterHandler = null
}
