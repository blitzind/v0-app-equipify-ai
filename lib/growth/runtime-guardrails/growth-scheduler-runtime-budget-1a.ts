/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Request-scoped scheduler wall-clock budget (server-only).
 * One invocation only — no persistence.
 */

import "server-only"

import {
  GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
} from "@/lib/growth/relationship/relationship-scale-limits"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"

export const GROWTH_SCHEDULER_RUNTIME_BUDGET_1A_QA_MARKER =
  "ge-aios-scheduler-runtime-optimization-1a-budget-v1" as const

export const GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER =
  "ge-aios-live-5a-scheduler-budget-reservation-v1" as const

export const GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER =
  "ge-aios-live-5c-scheduler-budget-clamp-v1" as const

/** Maximum objective reservation derived from scheduler wall minus portfolio sub-tick cap. */
export function resolveSchedulerObjectiveExecutionReservationCapMs(): number {
  return (
    GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS -
    GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs
  )
}

/** Reserved wall-clock for selected objective ticks (concurrency-aware batches). */
export function resolveSchedulerObjectiveExecutionReservationMs(
  selectedObjectiveCount: number,
  input?: {
    objectiveTimeoutMs?: number
    objectiveConcurrency?: number
  },
): number {
  if (selectedObjectiveCount <= 0) return 0
  const objectiveTimeoutMs =
    input?.objectiveTimeoutMs ?? GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS
  const objectiveConcurrency =
    input?.objectiveConcurrency ?? GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT
  const batchReservation =
    Math.ceil(selectedObjectiveCount / Math.max(1, objectiveConcurrency)) * objectiveTimeoutMs
  return Math.min(batchReservation, resolveSchedulerObjectiveExecutionReservationCapMs())
}

/** Sub-tick budget capped by remaining wall minus objective reservation. */
export function resolveSchedulerSubTickBudgetMs(input: {
  subTickCapMs: number
  remainingMs: number
  objectiveReservationMs: number
}): number {
  const reserved = Math.max(0, Math.floor(input.objectiveReservationMs))
  const remaining = Math.max(0, Math.floor(input.remainingMs))
  const allowable = Math.max(0, remaining - reserved)
  return Math.min(Math.max(0, Math.floor(input.subTickCapMs)), allowable)
}

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
