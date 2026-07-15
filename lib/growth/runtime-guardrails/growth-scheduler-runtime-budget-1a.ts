/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Request-scoped scheduler wall-clock budget (server-only).
 * One invocation only — no persistence.
 */

import "server-only"

export const GROWTH_SCHEDULER_RUNTIME_BUDGET_1A_QA_MARKER =
  "ge-aios-scheduler-runtime-optimization-1a-budget-v1" as const

export type SchedulerRuntimeBudgetStopReason =
  | "budget_exhausted"
  | "insufficient_safe_window"
  | "deadline_reached"
  | null

export type SchedulerRuntimeBudget = {
  qaMarker: typeof GROWTH_SCHEDULER_RUNTIME_BUDGET_1A_QA_MARKER
  startedAtMs: number
  deadlineMs: number
  maxRuntimeMs: number
  minSafeWindowMs: number
  elapsedMs: () => number
  remainingMs: () => number
  mayBeginWork: (minimumMs?: number) => boolean
  stopReason: (minimumMs?: number) => SchedulerRuntimeBudgetStopReason
}

export function createSchedulerRuntimeBudget(input: {
  startedAtMs?: number
  maxRuntimeMs: number
  minSafeWindowMs?: number
}): SchedulerRuntimeBudget {
  const startedAtMs = input.startedAtMs ?? Date.now()
  const maxRuntimeMs = Math.max(1, Math.floor(input.maxRuntimeMs))
  const minSafeWindowMs = Math.max(500, Math.floor(input.minSafeWindowMs ?? 2_000))
  const deadlineMs = startedAtMs + maxRuntimeMs

  const elapsedMs = () => Date.now() - startedAtMs
  const remainingMs = () => Math.max(0, deadlineMs - Date.now())

  const stopReason = (minimumMs = minSafeWindowMs): SchedulerRuntimeBudgetStopReason => {
    const remaining = remainingMs()
    if (remaining <= 0) return "deadline_reached"
    if (remaining < minimumMs) return "insufficient_safe_window"
    if (remaining < minSafeWindowMs) return "budget_exhausted"
    return null
  }

  return {
    qaMarker: GROWTH_SCHEDULER_RUNTIME_BUDGET_1A_QA_MARKER,
    startedAtMs,
    deadlineMs,
    maxRuntimeMs,
    minSafeWindowMs,
    elapsedMs,
    remainingMs,
    mayBeginWork: (minimumMs = minSafeWindowMs) => stopReason(minimumMs) === null,
    stopReason,
  }
}

export async function withSchedulerWorkTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  label = "scheduler_work",
): Promise<T> {
  const limit = Math.max(1, Math.floor(timeoutMs))
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label}_timeout_${limit}ms`)),
          limit,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
