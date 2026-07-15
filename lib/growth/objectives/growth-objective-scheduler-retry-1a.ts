/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Failure classification for scheduler retries (no parallel engine).
 */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"

export const GROWTH_OBJECTIVE_SCHEDULER_RETRY_1A_QA_MARKER =
  "ge-aios-scheduler-runtime-optimization-1a-retry-v1" as const

export type SchedulerFailureClass =
  | "transient_provider"
  | "rate_limited"
  | "timeout"
  | "missing_prerequisite"
  | "operator_blocked"
  | "prospect_wait"
  | "invalid_account"
  | "configuration_error"
  | "unknown"

const BACKOFF_BASE_MS = 60_000
const BACKOFF_MAX_MS = 30 * 60_000

export function classifySchedulerFailure(error: unknown): SchedulerFailureClass {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  if (message.includes("timeout") || message.includes("_timeout_")) return "timeout"
  if (message.includes("rate_limit") || message.includes("429")) return "rate_limited"
  if (message.includes("operator_blocked") || message.includes("waiting_for_approval")) {
    return "operator_blocked"
  }
  if (message.includes("prospect_wait") || message.includes("wait_until")) return "prospect_wait"
  if (message.includes("prerequisite") || message.includes("not_found") || message.includes("missing")) {
    return "missing_prerequisite"
  }
  if (message.includes("invalid_account") || message.includes("disqualified")) return "invalid_account"
  if (message.includes("configuration") || message.includes("schema") || message.includes("migration")) {
    return "configuration_error"
  }
  if (
    message.includes("provider") ||
    message.includes("datamoon") ||
    message.includes("network") ||
    message.includes("econn")
  ) {
    return "transient_provider"
  }
  return "unknown"
}

export function schedulerBackoffMsForObjective(objective: GrowthObjective): number {
  const attempts = objective.runtime?.schedulerRetryAttempts ?? 0
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(0, attempts)), BACKOFF_MAX_MS)
}

export function isObjectiveSchedulerBackoffElapsed(
  objective: GrowthObjective,
  now = Date.now(),
): boolean {
  const lastResult = objective.runtime?.lastSchedulerResult
  if (!lastResult?.failed) return true
  const lastAt = lastResult.at ? Date.parse(lastResult.at) : 0
  if (!Number.isFinite(lastAt) || lastAt <= 0) return true
  return now - lastAt >= schedulerBackoffMsForObjective(objective)
}

export function shouldIncrementSchedulerRetryForFailure(failureClass: SchedulerFailureClass): boolean {
  return (
    failureClass === "transient_provider" ||
    failureClass === "rate_limited" ||
    failureClass === "timeout" ||
    failureClass === "unknown"
  )
}

export function shouldDeferWithoutRetryInflation(failureClass: SchedulerFailureClass): boolean {
  return (
    failureClass === "operator_blocked" ||
    failureClass === "prospect_wait" ||
    failureClass === "missing_prerequisite"
  )
}
