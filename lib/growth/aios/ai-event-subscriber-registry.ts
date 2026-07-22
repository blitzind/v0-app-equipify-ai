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

export type AiOsEventHandlerRunRecord = {
  subscriberId: string
  status: "invoked" | "failed"
  durationMs: number
  errorMessage?: string
}

export async function invokeRegisteredAiOsEventHandlers(
  event: AiOsEvent,
): Promise<{
  discovered: string[]
  invoked: string[]
  failures: string[]
  skipped: string[]
  runs: AiOsEventHandlerRunRecord[]
}> {
  const discovered = listRegisteredAiOsEventHandlers()
  const invoked: string[] = []
  const failures: string[] = []
  const runs: AiOsEventHandlerRunRecord[] = []

  for (const subscriberId of discovered) {
    const entry = handlers.get(subscriberId)
    if (!entry) continue
    const startedAt = Date.now()
    try {
      await entry.handler(event)
      invoked.push(entry.subscriberId)
      runs.push({
        subscriberId: entry.subscriberId,
        status: "invoked",
        durationMs: Date.now() - startedAt,
      })
    } catch (error) {
      failures.push(entry.subscriberId)
      runs.push({
        subscriberId: entry.subscriberId,
        status: "failed",
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      })
    }
  }

  const skipped = discovered.filter((id) => !invoked.includes(id) && !failures.includes(id))
  return { discovered, invoked, failures, skipped, runs }
}

export function clearAiOsEventHandlersForTests(): void {
  handlers.clear()
}
