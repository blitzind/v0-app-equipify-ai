/** GE-AUTO-2B/2C/2D + GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Objective runtime scheduler (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { generateGrowthObjectiveAdaptiveRecommendations } from "@/lib/growth/objectives/growth-objective-adaptive-engine"
import {
  listEligibleGrowthObjectivesForSchedulerTick,
  listActiveRunningGrowthObjectiveOrganizationIds,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import {
  autoContinueGrowthObjectiveRuntime,
  retryGrowthObjectiveStage,
  tickGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-runtime-service"
import { runGrowthMissionRuntimeOrchestration } from "@/lib/growth/mission-center/growth-mission-runtime-orchestrator"
import { isMissionRuntimeOrchestrationReady } from "@/lib/growth/mission-center/growth-mission-runtime-orchestration-readiness"
import { tickAutonomousSalesLoopForScheduler } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { tickDraftFactoryDueStatesForScheduler } from "@/lib/growth/draft-factory/draft-factory-due-scheduler-tick"
import { tickAutonomousPortfolioManagerForScheduler } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a"
import { tickAutonomousProductionMissionBootstrapForScheduler } from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a-service"
import { buildObjectiveSignalSnapshot } from "@/lib/growth/objectives/growth-objective-signal-handler"
import {
  classifySchedulerFailure,
  shouldIncrementSchedulerRetryForFailure,
} from "@/lib/growth/objectives/growth-objective-scheduler-retry-1a"
import { selectSchedulerObjectivesWithOrgFairness } from "@/lib/growth/objectives/growth-objective-scheduler-selection-1a"
import { checkSchedulerProviderBudgetGate } from "@/lib/growth/objectives/growth-objective-scheduler-provider-budget-1a"
import {
  GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A,
  GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
  type GrowthObjectiveSchedulerTickTelemetry,
} from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import {
  GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_WORK_TIMEOUT_MS,
} from "@/lib/growth/relationship/relationship-scale-limits"
import { mapWithBoundedConcurrency } from "@/lib/growth/runtime-guardrails/growth-bounded-concurrency"
import {
  createSchedulerRuntimeBudget,
  resolveSchedulerObjectiveExecutionReservationMs,
  resolveSchedulerSubTickBudgetMs,
  withSchedulerWorkTimeout,
} from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import {
  GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveSchedulerLastResult,
} from "@/lib/growth/objectives/growth-objective-types"

const STALL_THRESHOLD_MS = 45 * 60 * 1000
const MAX_OBJECTIVES_PER_TICK = GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT
const MAX_ORGS_PER_TICK = GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT
const MAX_SCHEDULER_RUNTIME_MS = GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS

function isObjectiveStalled(objective: GrowthObjective, now = Date.now()): boolean {
  const lastActivity = objective.runtime?.lastTickAt ?? objective.runtime?.lastSignalAt ?? objective.runtime?.startedAt
  if (!lastActivity) return false
  const elapsed = now - Date.parse(lastActivity)
  return elapsed >= STALL_THRESHOLD_MS
}

async function persistObjectiveSchedulerTouch(
  admin: SupabaseClient,
  objective: GrowthObjective,
  input: {
    stalled: boolean
    retried: boolean
    ticked: boolean
    failed: boolean
    incrementRetry?: boolean
    failureClass?: string | null
  },
): Promise<void> {
  if (!objective.runtime) return
  const now = new Date().toISOString()
  const lastSchedulerResult: GrowthObjectiveSchedulerLastResult = {
    ticksAttempted: input.ticked ? 1 : 0,
    retriesAttempted: input.retried ? 1 : 0,
    stalledDetected: input.stalled,
    failed: input.failed,
    at: now,
  }

  await updateGrowthObjective(admin, objective.organizationId, objective.id, {
    runtime: {
      ...objective.runtime,
      lastSchedulerAt: now,
      schedulerRunCount: (objective.runtime.schedulerRunCount ?? 0) + 1,
      schedulerRetryAttempts:
        (objective.runtime.schedulerRetryAttempts ?? 0) + (input.incrementRetry ? 1 : 0),
      stalledSince:
        input.stalled && !objective.runtime.stalledSince
          ? now
          : !input.stalled
            ? null
            : objective.runtime.stalledSince ?? null,
      lastSchedulerResult,
    },
  }).catch(() => undefined)
}

async function runObjectiveSchedulerWork(
  admin: SupabaseClient,
  objective: GrowthObjective,
  input?: { certificationMode?: boolean },
): Promise<{
  retried: boolean
  ticked: boolean
  stalled: boolean
  missionOrchestrationsAttempted: number
  recommendationsRefreshed: number
}> {
  const stageId = objective.runtime?.currentStageId
  const stageState = stageId ? objective.runtime?.stageStates[stageId] : null
  const stalled = isObjectiveStalled(objective)

  const snapshot = buildObjectiveSignalSnapshot(objective.recentSignals ?? [])
  const recommendations = generateGrowthObjectiveAdaptiveRecommendations({ objective, signals: snapshot })

  let retried = false
  let ticked = false
  let missionOrchestrationsAttempted = 0

  if (stageState?.state === "blocked") {
    await retryGrowthObjectiveStage(admin, objective.organizationId, objective.id, input)
    retried = true
  } else if (stalled || stageState?.state === "pending" || stageState?.state === "running") {
    await tickGrowthObjectiveRuntime(admin, objective.organizationId, objective.id, input)
    ticked = true
    await autoContinueGrowthObjectiveRuntime(admin, objective.organizationId, objective.id, input)
  }

  if (isMissionRuntimeOrchestrationReady(objective)) {
    await runGrowthMissionRuntimeOrchestration(admin, objective.organizationId, objective.id, input)
    missionOrchestrationsAttempted = 1
  }

  return {
    retried,
    ticked,
    stalled,
    missionOrchestrationsAttempted,
    recommendationsRefreshed: recommendations.length > 0 ? 1 : 0,
  }
}

export type GrowthObjectiveRuntimeSchedulerResult = {
  qa_marker: typeof GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER
  optimization_qa_marker: typeof GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER
  objectivesScanned: number
  objectivesSelected: number
  ticksAttempted: number
  retriesAttempted: number
  stalledDetected: number
  recommendationsRefreshed: number
  missionOrchestrationsAttempted: number
  failures: number
  skippedReason: string | null
  telemetry: GrowthObjectiveSchedulerTickTelemetry
  autonomousSalesLoop: import("@/lib/growth/specialists/execution/autonomous-sales-loop-types").AutonomousSalesSchedulerTickResult | null
  draftFactoryDue: import("@/lib/growth/draft-factory/draft-factory-due-scheduler-tick").DraftFactoryDueSchedulerTickResult | null
}

export async function runGrowthObjectiveRuntimeScheduler(
  admin: SupabaseClient,
  input?: { certificationMode?: boolean },
): Promise<GrowthObjectiveRuntimeSchedulerResult> {
  const budget = createSchedulerRuntimeBudget({
    maxRuntimeMs: MAX_SCHEDULER_RUNTIME_MS,
    minSafeWindowMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.minSafeWindowMs,
  })

  const telemetry: GrowthObjectiveSchedulerTickTelemetry = {
    organizationsConsidered: 0,
    organizationsSelected: 0,
    objectivesFetched: 0,
    objectivesSelected: 0,
    accountsInspected: 0,
    accountsStarted: 0,
    accountsCompleted: 0,
    accountsDeferred: 0,
    accountsTimedOut: 0,
    providerBudgetBlocks: 0,
    operatorBlocks: 0,
    prospectWaits: 0,
    draftFactoryAdvances: 0,
    packagesGenerated: 0,
    elapsedMs: 0,
    remainingMsAtStop: 0,
    stopReason: null,
    objectiveTicksDeferred: 0,
  }

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const fetchedObjectives = await listEligibleGrowthObjectivesForSchedulerTick(admin)
  telemetry.objectivesFetched = fetchedObjectives.length

  const selection = selectSchedulerObjectivesWithOrgFairness(fetchedObjectives, {
    maxObjectives: MAX_OBJECTIVES_PER_TICK,
    maxOrganizations: MAX_ORGS_PER_TICK,
  })
  telemetry.organizationsConsidered = selection.organizationsConsidered
  telemetry.organizationsSelected = selection.organizationsSelected

  const objectiveExecutionReservedMs =
    killSwitches.autonomy_enabled &&
    killSwitches.autonomy_objective_mode_enabled &&
    selection.selected.length > 0
      ? resolveSchedulerObjectiveExecutionReservationMs(selection.selected.length)
      : 0
  telemetry.objectiveExecutionReservedMs = objectiveExecutionReservedMs

  const productionMissionBootstrap =
    killSwitches.autonomy_enabled && killSwitches.autonomy_objective_mode_enabled && budget.mayBeginWork(3_000)
      ? await tickAutonomousProductionMissionBootstrapForScheduler(admin, {
          maxOrganizations: MAX_ORGS_PER_TICK,
        }).catch(() => null)
      : null

  if (productionMissionBootstrap) {
    telemetry.productionMissionBootstrapsAttempted = productionMissionBootstrap.organizationsAttempted
    telemetry.productionMissionBootstrapsCompleted = productionMissionBootstrap.organizationsBootstrapped
  }

  const schedulerOrganizationIds = await listActiveRunningGrowthObjectiveOrganizationIds(admin)

  let providerBudgetBlocks = 0
  const orgsWithBudget: string[] = []
  for (const organizationId of schedulerOrganizationIds) {
    const gate = await checkSchedulerProviderBudgetGate(admin, {
      organizationId,
      resourceType: "headless_objectives",
    }).catch(() => ({ allowed: true, remaining: 0, cap: 0 }))
    if (!gate.allowed) {
      providerBudgetBlocks += 1
      continue
    }
    orgsWithBudget.push(organizationId)
  }
  telemetry.providerBudgetBlocks = providerBudgetBlocks

  const salesLoopBudgetMs = resolveSchedulerSubTickBudgetMs({
    subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.salesLoopMs,
    remainingMs: budget.remainingMs(),
    objectiveReservationMs: objectiveExecutionReservedMs,
  })
  const autonomousSalesLoop = killSwitches.autonomy_enabled && budget.mayBeginWork(3_000)
    ? await tickAutonomousSalesLoopForScheduler(admin, {
        organizationIds: orgsWithBudget,
        startedAt: budget.startedAtMs,
        maxRuntimeMs: salesLoopBudgetMs,
        maxOrganizations: MAX_ORGS_PER_TICK,
        perOrganizationTimeoutMs: GROWTH_OBJECTIVE_SCHEDULER_ORG_WORK_TIMEOUT_MS,
      })
    : null

  if (autonomousSalesLoop) {
    telemetry.accountsInspected = autonomousSalesLoop.organizations_attempted
    telemetry.accountsStarted = autonomousSalesLoop.organizations_executed
    telemetry.accountsCompleted = autonomousSalesLoop.organization_results.filter(
      (row) => row.executed && row.stop_reason !== "context_unavailable",
    ).length
    telemetry.accountsDeferred = autonomousSalesLoop.organization_results.filter(
      (row) => !row.executed,
    ).length
    telemetry.accountsTimedOut = autonomousSalesLoop.organization_results.filter(
      (row) => row.stop_reason === "org_work_timeout",
    ).length
  }

  const portfolioBudgetMs = resolveSchedulerSubTickBudgetMs({
    subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs,
    remainingMs: budget.remainingMs(),
    objectiveReservationMs: objectiveExecutionReservedMs,
  })
  telemetry.portfolioBudgetMs = portfolioBudgetMs

  const autonomousPortfolioManager =
    killSwitches.autonomy_enabled && budget.mayBeginWork(3_000) && portfolioBudgetMs >= 3_000
      ? await tickAutonomousPortfolioManagerForScheduler(admin, {
          organizationIds: orgsWithBudget,
          maxOrganizations: MAX_ORGS_PER_TICK,
          startedAt: budget.startedAtMs,
          maxRuntimeMs: portfolioBudgetMs,
        }).catch(() => null)
      : null

  if (autonomousPortfolioManager) {
    telemetry.portfolioReplenishmentsAttempted = autonomousPortfolioManager.organizationsAttempted
    telemetry.portfolioReplenishmentsCompleted = autonomousPortfolioManager.organizationsReplenished
  }

  const draftFactoryBudgetMs = resolveSchedulerSubTickBudgetMs({
    subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.draftFactoryMs,
    remainingMs: budget.remainingMs(),
    objectiveReservationMs: objectiveExecutionReservedMs,
  })
  const draftFactoryDue = killSwitches.autonomy_enabled && budget.mayBeginWork(3_000)
    ? await tickDraftFactoryDueStatesForScheduler(admin, {
        organizationIds: orgsWithBudget,
        maxRuntimeMs: draftFactoryBudgetMs,
        maxOrganizations: MAX_ORGS_PER_TICK,
      })
    : null

  if (draftFactoryDue) {
    telemetry.draftFactoryAdvances = draftFactoryDue.due_advanced
    telemetry.packagesGenerated = draftFactoryDue.capacity_selected
  }

  if (!killSwitches.autonomy_enabled || !killSwitches.autonomy_objective_mode_enabled) {
    telemetry.elapsedMs = budget.elapsedMs()
    telemetry.remainingMsAtStop = budget.remainingMs()
    telemetry.stopReason = "objective_mode_disabled"
    return {
      qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
      optimization_qa_marker: GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
      objectivesScanned: fetchedObjectives.length,
      objectivesSelected: 0,
      ticksAttempted: 0,
      retriesAttempted: 0,
      stalledDetected: 0,
      recommendationsRefreshed: 0,
      missionOrchestrationsAttempted: 0,
      failures: 0,
      skippedReason: "Objective runtime scheduler disabled by kill switch.",
      telemetry,
      autonomousSalesLoop,
      draftFactoryDue,
    }
  }

  const objectives = selection.selected
  telemetry.objectivesSelected = objectives.length

  let ticksAttempted = 0
  let retriesAttempted = 0
  let stalledDetected = 0
  let recommendationsRefreshed = 0
  let missionOrchestrationsAttempted = 0
  let failures = 0
  let stopReason: string | null = null

  const results = await mapWithBoundedConcurrency(
    objectives,
    GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
    async (objective) => {
      if (!budget.mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS)) {
        return { kind: "deferred" as const, objective }
      }

      let retried = false
      let ticked = false
      let failureClass: ReturnType<typeof classifySchedulerFailure> | null = null

      try {
        const work = await withSchedulerWorkTimeout(
          runObjectiveSchedulerWork(admin, objective, input),
          GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
          "objective_tick",
        )

        await persistObjectiveSchedulerTouch(admin, objective, {
          stalled: work.stalled,
          retried: work.retried,
          ticked: work.ticked,
          failed: false,
        })
        return { kind: "completed" as const, objective, work }
      } catch (error) {
        failureClass = classifySchedulerFailure(error)
        await persistObjectiveSchedulerTouch(admin, objective, {
          stalled: isObjectiveStalled(objective),
          retried,
          ticked,
          failed: true,
          incrementRetry: shouldIncrementSchedulerRetryForFailure(failureClass),
          failureClass,
        })
        return { kind: "failed" as const, objective, failureClass }
      }
    },
  )

  for (const result of results) {
    if (result.kind === "deferred") {
      telemetry.objectiveTicksDeferred += 1
      continue
    }
    if (result.kind === "failed") {
      failures += 1
      if (result.failureClass === "timeout") telemetry.accountsTimedOut += 1
      if (result.failureClass === "operator_blocked") telemetry.operatorBlocks += 1
      if (result.failureClass === "prospect_wait") telemetry.prospectWaits += 1
      continue
    }
    if (result.work.retried) retriesAttempted += 1
    if (result.work.ticked) ticksAttempted += 1
    if (result.work.stalled) stalledDetected += 1
    recommendationsRefreshed += result.work.recommendationsRefreshed
    missionOrchestrationsAttempted += result.work.missionOrchestrationsAttempted
  }

  if (telemetry.objectiveTicksDeferred > 0) {
    stopReason = stopReason ?? "objective_budget_deferred"
  }
  if (budget.stopReason() && !stopReason) {
    stopReason = budget.stopReason()
  }

  telemetry.elapsedMs = budget.elapsedMs()
  telemetry.remainingMsAtStop = budget.remainingMs()
  telemetry.stopReason = stopReason

  logGrowthEngine("growth_objective_runtime_scheduler", {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
    optimization_qa_marker: GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
    call_graph: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.entry,
    objectives_fetched: telemetry.objectivesFetched,
    objectives_selected: telemetry.objectivesSelected,
    organizations_considered: telemetry.organizationsConsidered,
    organizations_selected: telemetry.organizationsSelected,
    ticks_attempted: ticksAttempted,
    retries_attempted: retriesAttempted,
    stalled_detected: stalledDetected,
    mission_orchestrations_attempted: missionOrchestrationsAttempted,
    failures,
    objective_ticks_deferred: telemetry.objectiveTicksDeferred,
    objective_execution_reserved_ms: telemetry.objectiveExecutionReservedMs,
    portfolio_budget_ms: telemetry.portfolioBudgetMs,
    objective_results: results.length,
    runtime_ms: telemetry.elapsedMs,
    remaining_ms_at_stop: telemetry.remainingMsAtStop,
    stop_reason: telemetry.stopReason,
    provider_budget_blocks: telemetry.providerBudgetBlocks,
    accounts_timed_out: telemetry.accountsTimedOut,
    autonomous_sales_loop: autonomousSalesLoop
      ? {
          organizations_attempted: autonomousSalesLoop.organizations_attempted,
          organizations_executed: autonomousSalesLoop.organizations_executed,
          total_outcomes_completed: autonomousSalesLoop.total_outcomes_completed,
          skipped_reason: autonomousSalesLoop.skipped_reason,
        }
      : null,
    draft_factory_due: draftFactoryDue
      ? {
          organizations_attempted: draftFactoryDue.organizations_attempted,
          due_states_found: draftFactoryDue.due_states_found,
          due_advanced: draftFactoryDue.due_advanced,
          capacity_selected: draftFactoryDue.capacity_selected,
          failures: draftFactoryDue.failures,
          skipped_reason: draftFactoryDue.skipped_reason,
          admission_reconcile: draftFactoryDue.admission_reconcile ?? null,
        }
      : null,
  })

  return {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
    optimization_qa_marker: GROWTH_SCHEDULER_RUNTIME_OPTIMIZATION_1A_QA_MARKER,
    objectivesScanned: fetchedObjectives.length,
    objectivesSelected: objectives.length,
    ticksAttempted,
    retriesAttempted,
    stalledDetected,
    recommendationsRefreshed,
    missionOrchestrationsAttempted,
    failures,
    skippedReason: null,
    telemetry,
    autonomousSalesLoop,
    draftFactoryDue,
  }
}

export const GrowthObjectiveRuntimeScheduler = {
  runGrowthObjectiveRuntimeScheduler,
  MAX_OBJECTIVES_PER_TICK,
  MAX_ORGS_PER_TICK,
  MAX_SCHEDULER_RUNTIME_MS,
} as const
