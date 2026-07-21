/** GE-AIOS-RUNTIME-SCALE-1A — Production scale targets (500/day org throughput). */

export const GROWTH_RUNTIME_SCALE_1A_QA_MARKER = "ge-aios-runtime-scale-1a-v1" as const

/** Equipify production research target per active organization. */
export const GROWTH_ORG_RESEARCH_TARGET_PER_DAY = 500 as const

/** Headroom target for burst / catch-up. */
export const GROWTH_ORG_RESEARCH_HEADROOM_PER_DAY = 750 as const

/** Minimum successful completions per 20-minute scheduler cycle (500 ÷ 72 ≈ 7). */
export const GROWTH_SCHEDULER_RESEARCH_COMPLETIONS_PER_CYCLE_MIN = 7 as const

/** Target completions per cycle for headroom (750 ÷ 72 ≈ 10.4 → 12). */
export const GROWTH_SCHEDULER_RESEARCH_COMPLETIONS_PER_CYCLE_TARGET = 12 as const

/** Max work items attempted per org per scheduler tick. */
export const AUTONOMOUS_SALES_LOOP_SCHEDULER_MAX_ITERATIONS_SCALE_1A = 12 as const

/** Bounded parallel research workers per batch (not unbounded Promise.all). */
export const GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS = 6 as const

/** Wall clock per research lead before yielding to the batch. */
export const AUTONOMOUS_SALES_LOOP_RESEARCH_WORK_ITEM_TIMEOUT_MS = 90_000 as const

/** Scheduler sales-loop sub-budget for scale workloads. */
export const GROWTH_SCHEDULER_SALES_LOOP_BUDGET_MS_SCALE_1A = 90_000 as const

/** Scheduler outer wall for scale workloads. */
export const GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS_SCALE_1A = 120_000 as const

/** Org ASL timeout floor under scale (parallel batches). */
export const AUTONOMOUS_SALES_LOOP_SCHEDULER_MIN_ORG_TIMEOUT_MS_SCALE_1A = 85_000 as const

/** Crawl pages per company (observed cost driver — no LLM per page). */
export const GROWTH_SCALE_OBSERVED_CRAWL_PAGES_PER_COMPANY = 12 as const

export function computeRequiredResearchConcurrency(input: {
  targetPerDay: number
  schedulerCyclesPerDay?: number
  avgResearchDurationMs: number
  cycleBudgetMs: number
}): {
  completionsPerCycle: number
  requiredConcurrency: number
  cyclesPerDay: number
} {
  const cyclesPerDay = input.schedulerCyclesPerDay ?? 72
  const completionsPerCycle = Math.ceil(input.targetPerDay / cyclesPerDay)
  const wavesPerCycle = Math.ceil(completionsPerCycle / Math.max(1, GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS))
  const cycleTimeNeededMs = wavesPerCycle * input.avgResearchDurationMs
  const requiredConcurrency =
    cycleTimeNeededMs <= input.cycleBudgetMs
      ? GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS
      : Math.min(
          GROWTH_ORG_MAX_CONCURRENT_RESEARCH_JOBS,
          Math.max(
            1,
            Math.ceil((completionsPerCycle * input.avgResearchDurationMs) / input.cycleBudgetMs),
          ),
        )
  return { completionsPerCycle, requiredConcurrency, cyclesPerDay }
}

export function projectDailyResearchFromHourlyRate(researchedLastHour: number): number {
  return Math.round(researchedLastHour * 24)
}

export function projectEndOfDayTotal(input: {
  researchedToday: number
  researchedLastHour: number
  generatedAtIso: string
}): number {
  const now = Date.parse(input.generatedAtIso)
  if (!Number.isFinite(now)) return input.researchedToday
  const startOfDay = new Date(input.generatedAtIso)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const elapsedHours = Math.max(0.25, (now - startOfDay.getTime()) / 3_600_000)
  const ratePerHour = input.researchedLastHour > 0 ? input.researchedLastHour : input.researchedToday / elapsedHours
  const remainingHours = Math.max(0, 24 - elapsedHours)
  return Math.round(input.researchedToday + ratePerHour * remainingHours)
}
