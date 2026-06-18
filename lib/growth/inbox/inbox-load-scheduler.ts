/** Idle/deferred task scheduling for Growth Inbox load shedding (Phase 8F.2). */

export const GROWTH_INBOX_LOAD_SCHEDULER_QA_MARKER = "growth-inbox-load-scheduler-v1" as const

export type GrowthInboxIdleTaskOptions = {
  /** Fallback delay when requestIdleCallback is unavailable. */
  timeoutMs?: number
}

export function scheduleGrowthInboxIdleTask(
  task: () => void,
  options?: GrowthInboxIdleTaskOptions,
): () => void {
  if (typeof window === "undefined") {
    task()
    return () => undefined
  }

  const timeoutMs = options?.timeoutMs ?? 50
  let cancelled = false

  const run = () => {
    if (!cancelled) task()
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(run, { timeout: Math.max(timeoutMs, 250) })
    return () => {
      cancelled = true
      window.cancelIdleCallback(idleId)
    }
  }

  const timerId = window.setTimeout(run, timeoutMs)
  return () => {
    cancelled = true
    window.clearTimeout(timerId)
  }
}
