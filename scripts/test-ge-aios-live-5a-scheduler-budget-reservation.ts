/**
 * GE-AIOS-LIVE-5A — Scheduler runtime budget reservation (local cert).
 *
 * Run:
 *   pnpm test:ge-aios-live-5a-scheduler-budget-reservation
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import {
  GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER,
  createSchedulerRuntimeBudget,
  resolveSchedulerObjectiveExecutionReservationCapMs,
  resolveSchedulerObjectiveExecutionReservationMs,
  resolveSchedulerSubTickBudgetMs,
} from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import {
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
} from "@/lib/growth/relationship/relationship-scale-limits"

const PHASE = "GE-AIOS-LIVE-5A" as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Scheduler runtime budget reservation`)
  console.log(`QA marker: ${GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER}`)

  assert.equal(
    GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER,
    "ge-aios-live-5a-scheduler-budget-reservation-v1",
  )

  assert.equal(GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs, 25_000)

  assert.equal(resolveSchedulerObjectiveExecutionReservationMs(0), 0)
  assert.equal(
    resolveSchedulerObjectiveExecutionReservationMs(1),
    GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
  )
  assert.equal(
    resolveSchedulerObjectiveExecutionReservationMs(4),
    2 * GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
  )
  assert.equal(
    resolveSchedulerObjectiveExecutionReservationMs(5),
    resolveSchedulerObjectiveExecutionReservationCapMs(),
  )
  console.log("  ✓ objective reservation scales with concurrency batches")

  assert.equal(
    resolveSchedulerSubTickBudgetMs({
      subTickCapMs: 25_000,
      remainingMs: 45_000,
      objectiveReservationMs: 20_000,
    }),
    25_000,
  )
  assert.equal(
    resolveSchedulerSubTickBudgetMs({
      subTickCapMs: 25_000,
      remainingMs: 22_000,
      objectiveReservationMs: 20_000,
    }),
    2_000,
  )
  assert.equal(
    resolveSchedulerSubTickBudgetMs({
      subTickCapMs: 25_000,
      remainingMs: 40_000,
      objectiveReservationMs: 0,
    }),
    25_000,
  )
  console.log("  ✓ sub-tick budget respects objective reservation")

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(schedulerSource, /resolveSchedulerObjectiveExecutionReservationMs/)
  assert.match(schedulerSource, /resolveSchedulerSubTickBudgetMs/)
  assert.match(schedulerSource, /portfolioManagerMs/)
  assert.match(schedulerSource, /objectiveExecutionReservedMs/)
  assert.match(schedulerSource, /portfolioBudgetMs/)
  assert.match(schedulerSource, /maxRuntimeMs: portfolioBudgetMs/)
  assert.doesNotMatch(schedulerSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  console.log("  ✓ scheduler reserves objective window and caps portfolio budget")

  const portfolioSource = readSource(
    "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  )
  assert.match(portfolioSource, /maxRuntimeMs/)
  assert.match(portfolioSource, /Date\.now\(\) - startedAt >= maxRuntimeMs/)
  assert.doesNotMatch(portfolioSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  assert.doesNotMatch(portfolioSource, /runGrowthMissionRuntimeOrchestration/)
  console.log("  ✓ portfolio tick honors maxRuntimeMs; no mission sync authority")

  const orchestratorSource = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")
  assert.match(orchestratorSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  assert.match(orchestratorSource, /persistMissionRuntime/)
  console.log("  ✓ mission sync remains in orchestrator only")

  // Scenario 1 — portfolio completes quickly, objective window remains
  {
    const budget = createSchedulerRuntimeBudget({ maxRuntimeMs: 45_000 })
    const reservation = resolveSchedulerObjectiveExecutionReservationMs(1)
    const portfolioBudget = resolveSchedulerSubTickBudgetMs({
      subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs,
      remainingMs: budget.remainingMs(),
      objectiveReservationMs: reservation,
    })
    assert.ok(portfolioBudget >= 3_000)
    assert.ok(budget.mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS))
    console.log("  ✓ scenario 1 — fast portfolio leaves objective execution window")
  }

  // Scenario 2 — expensive portfolio capped, objective reservation preserved
  {
    const budget = createSchedulerRuntimeBudget({
      maxRuntimeMs: 45_000,
      startedAtMs: Date.now() - 44_500,
    })
    const reservation = resolveSchedulerObjectiveExecutionReservationMs(4)
    const portfolioBudget = resolveSchedulerSubTickBudgetMs({
      subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs,
      remainingMs: budget.remainingMs(),
      objectiveReservationMs: reservation,
    })
    assert.equal(portfolioBudget, 0)
    assert.equal(
      budget.mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS),
      false,
      "without reservation this tick would defer objectives",
    )

    const reservedBudget = createSchedulerRuntimeBudget({
      maxRuntimeMs: 45_000,
      startedAtMs: Date.now() - 24_000,
    })
    const reservedPortfolioBudget = resolveSchedulerSubTickBudgetMs({
      subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs,
      remainingMs: reservedBudget.remainingMs(),
      objectiveReservationMs: reservation,
    })
    assert.ok(reservedPortfolioBudget > 0)
    assert.ok(reservedBudget.mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS))
    console.log("  ✓ scenario 2 — portfolio capped; objective reservation prevents starvation")
  }

  // Scenario 3 — no objectives selected, portfolio may use remaining budget
  {
    const reservation = resolveSchedulerObjectiveExecutionReservationMs(0)
    assert.equal(reservation, 0)
    const portfolioBudget = resolveSchedulerSubTickBudgetMs({
      subTickCapMs: GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs,
      remainingMs: 40_000,
      objectiveReservationMs: reservation,
    })
    assert.equal(portfolioBudget, 25_000)
    console.log("  ✓ scenario 3 — no reservation when no objectives selected")
  }

  // Scenario 4 — selected mission batch reservation covers orchestration window
  {
    const reservation = resolveSchedulerObjectiveExecutionReservationMs(1)
    assert.equal(reservation, GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS)
    assert.ok(reservation >= GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS)
    assert.equal(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_CONCURRENCY_LIMIT, 2)
    console.log("  ✓ scenario 4 — selected mission receives guaranteed orchestration window")
  }

  console.log(`\n[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
