/** GE-AIOS-RUNTIME-THROUGHPUT-1A — Scheduler throughput tuning (existing workers only). */

export const GROWTH_RUNTIME_THROUGHPUT_1A_QA_MARKER =
  "ge-aios-runtime-throughput-1a-v1" as const

/** Scheduler path: process multiple leads per org tick when budget allows. */
export const AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS = 4 as const

/** Per work-item wall clock — slow leads yield instead of consuming the org budget. */
export const AUTONOMOUS_SALES_LOOP_PER_WORK_ITEM_TIMEOUT_MS = 25_000 as const

/** Org tick budget floor — research exceeds legacy 8s org timeout. */
export const AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS = 35_000 as const

/** Home treats operator activity older than this as stale for "Working" state. */
export const GROWTH_HOME_STALE_AUTONOMOUS_ACTIVITY_MS = 20 * 60 * 1000

/** Recent in-progress window aligned with a single scheduler cycle. */
export const GROWTH_HOME_RECENT_AUTONOMOUS_ACTIVITY_MS = 5 * 60 * 1000

export function resolveAutonomousSalesLoopSchedulerOrgTimeoutMs(input: {
  salesLoopBudgetMs: number
  organizationCount: number
}): number {
  const orgCount = Math.max(1, input.organizationCount)
  const fairShare = Math.floor(input.salesLoopBudgetMs / orgCount)
  return Math.min(
    Math.max(AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS, fairShare),
    Math.max(AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS, input.salesLoopBudgetMs - 500),
  )
}
