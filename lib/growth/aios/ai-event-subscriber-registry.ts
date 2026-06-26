/** GE-AIOS-2B — In-process subscriber handler registry (server-only). */

import "server-only"

import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"

export type AiOsEventSubscriberHandler = (event: AiOsEvent) => void | Promise<void>

type RegisteredHandler = {
  subscriberId: string
  handler: AiOsEventSubscriberHandler
}

const handlers = new Map<string, RegisteredHandler>()

export function registerAiOsEventHandler(input: {
  subscriberId: string
  handler: AiOsEventSubscriberHandler
}): () => void {
  handlers.set(input.subscriberId, {
    subscriberId: input.subscriberId,
    handler: input.handler,
  })
  return () => {
    handlers.delete(input.subscriberId)
  }
}

export function listRegisteredAiOsEventHandlers(): string[] {
  return [...handlers.keys()]
}

export async function invokeRegisteredAiOsEventHandlers(event: AiOsEvent): Promise<string[]> {
  const invoked: string[] = []
  for (const entry of handlers.values()) {
    await entry.handler(event)
    invoked.push(entry.subscriberId)
  }
  return invoked
}

export function clearAiOsEventHandlersForTests(): void {
  handlers.clear()
}
