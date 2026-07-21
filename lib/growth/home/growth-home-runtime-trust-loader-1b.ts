/** GE-AIOS-LAUNCH-1B — Server loader for Home runtime trust (read-only, no new engines). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildGrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a"
import { withGrowthHomeLoaderBudget } from "@/lib/growth/home/growth-home-workspace-loader-budget"
import {
  GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
  type GrowthHomeRuntimeTrustServerPayload,
} from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

const SCHEDULER_INTERVAL_MS = 20 * 60 * 1000
const STEP_BUDGET_MS = 1_200

export async function loadGrowthHomeRuntimeTrustPayload(input: {
  admin: SupabaseClient
  generatedAt: string
  budgetMs?: number
}): Promise<GrowthHomeRuntimeTrustServerPayload> {
  const schedulerRoute = growthCronApiPath("growth-objective-runtime-scheduler")

  const [killSwitchesStep, autonomyTickStep, schedulerStep] = await Promise.all([
    withGrowthHomeLoaderBudget({
      label: "runtime_trust_kill_switches",
      budgetMs: STEP_BUDGET_MS,
      fn: () => getRuntimeKillSwitchStates(input.admin),
      fallback: {},
    }),
    withGrowthHomeLoaderBudget({
      label: "runtime_trust_autonomy_tick_health",
      budgetMs: STEP_BUDGET_MS,
      fn: () => buildGrowthAiosAutonomyTickHealthSnapshot(input.admin),
      fallback: null,
    }),
    withGrowthHomeLoaderBudget({
      label: "runtime_trust_scheduler_telemetry",
      budgetMs: STEP_BUDGET_MS,
      fn: () => listRecentGrowthCronExecutionRuns(input.admin, { cronRoute: schedulerRoute, limit: 1 }),
      fallback: [],
    }),
  ])

  const killSwitches = killSwitchesStep.value
  const autonomyTickHealth = autonomyTickStep.value
  const schedulerRuns = schedulerStep.value

  const lastScheduler = schedulerRuns[0] ?? null
  const lastSchedulerRunAt = lastScheduler?.finishedAt ?? lastScheduler?.startedAt ?? null
  const nextSchedulerEstimateAt =
    lastSchedulerRunAt != null
      ? new Date(Date.parse(lastSchedulerRunAt) + SCHEDULER_INTERVAL_MS).toISOString()
      : null

  return {
    qaMarker: GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER,
    generatedAt: input.generatedAt,
    killSwitches,
    autonomyTickHealth,
    lastSchedulerRunAt,
    lastSchedulerOk: lastScheduler?.ok ?? null,
    nextSchedulerEstimateAt,
  }
}
