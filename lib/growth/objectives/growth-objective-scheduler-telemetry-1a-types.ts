/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Scheduler call graph + telemetry types (client-safe).
 */

export const GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER =
  "ge-aios-scheduler-runtime-optimization-1a-v1" as const

export const GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A = {
  entry: "/api/cron/growth-objective-runtime-scheduler",
  runner: "runGrowthCronJob → runGrowthObjectiveRuntimeScheduler",
  stages: [
    "kill_switch_probe",
    "eligible_objective_fetch",
    "org_fairness_selection",
    "autonomous_sales_loop_tick",
    "draft_factory_due_tick",
    "objective_runtime_ticks",
    "mission_orchestration",
    "scheduler_touch_persist",
    "telemetry_emit",
  ],
  budgets: {
    outerWallClockMs: 45_000,
    salesLoopMs: 20_000,
    draftFactoryMs: 15_000,
    objectiveTimeoutMs: 10_000,
    orgWorkTimeoutMs: 8_000,
    minSafeWindowMs: 2_000,
  },
  caps: {
    objectivesExecuted: 50,
    organizations: 20,
    eligibleFetch: 100,
    objectiveConcurrency: 2,
  },
} as const

export type GrowthObjectiveSchedulerTickTelemetry = {
  organizationsConsidered: number
  organizationsSelected: number
  objectivesFetched: number
  objectivesSelected: number
  accountsInspected: number
  accountsStarted: number
  accountsCompleted: number
  accountsDeferred: number
  accountsTimedOut: number
  providerBudgetBlocks: number
  operatorBlocks: number
  prospectWaits: number
  draftFactoryAdvances: number
  packagesGenerated: number
  portfolioReplenishmentsAttempted?: number
  portfolioReplenishmentsCompleted?: number
  elapsedMs: number
  remainingMsAtStop: number
  stopReason: string | null
  objectiveTicksDeferred: number
}
