/**
 * GE-AIOS-LIVE-5C — Scheduler budget reservation clamp (local cert).
 *
 * Run:
 *   pnpm test:ge-aios-live-5c-budget-clamp
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import {
  GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER,
  createSchedulerRuntimeBudget,
  resolveSchedulerObjectiveExecutionReservationCapMs,
  resolveSchedulerObjectiveExecutionReservationMs,
  resolveSchedulerSubTickBudgetMs,
} from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import {
  GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
} from "@/lib/growth/relationship/relationship-scale-limits"

const PHASE = "GE-AIOS-LIVE-5C" as const
const WALL = GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS
const PORTFOLIO_CAP = GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs
const RESERVATION_CAP = resolveSchedulerObjectiveExecutionReservationCapMs()

function readSource(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Scheduler budget reservation clamp`)
  console.log(`QA marker: ${GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER}`)

  assert.equal(GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER, "ge-aios-live-5c-scheduler-budget-clamp-v1")
  assert.equal(RESERVATION_CAP, WALL - PORTFOLIO_CAP)
  assert.equal(RESERVATION_CAP, 20_000)

  const budgetSource = readSource("lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a.ts")
  assert.match(budgetSource, /Math\.min\(batchReservation, resolveSchedulerObjectiveExecutionReservationCapMs\(\)\)/)
  assert.match(budgetSource, /GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS/)
  assert.match(budgetSource, /portfolioManagerMs/)
  assert.doesNotMatch(budgetSource, /20_000/)
  console.log("  ✓ clamp uses existing scheduler constants only")

  // Scenario 1
  assert.equal(resolveSchedulerObjectiveExecutionReservationMs(1), 10_000)
  console.log("  ✓ scenario 1 — 1 selected objective reserves 10s")

  // Scenario 2
  assert.equal(resolveSchedulerObjectiveExecutionReservationMs(4), 20_000)
  console.log("  ✓ scenario 2 — 4 selected objectives reserve 20s")

  // Scenario 3
  assert.equal(resolveSchedulerObjectiveExecutionReservationMs(10), RESERVATION_CAP)
  const portfolioAtStart = resolveSchedulerSubTickBudgetMs({
    subTickCapMs: PORTFOLIO_CAP,
    remainingMs: WALL,
    objectiveReservationMs: resolveSchedulerObjectiveExecutionReservationMs(10),
  })
  assert.equal(portfolioAtStart, PORTFOLIO_CAP)
  const budget = createSchedulerRuntimeBudget({ maxRuntimeMs: WALL })
  assert.ok(budget.mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS))
  console.log("  ✓ scenario 3 — 10 selected objectives clamped; portfolio and objectives retain budget")

  // Scenario 4
  for (const selected of [10, 20, 30, 40, 50]) {
    const reserved = resolveSchedulerObjectiveExecutionReservationMs(selected)
    assert.ok(reserved <= WALL)
    assert.ok(reserved <= RESERVATION_CAP)
    const portfolioBudget = resolveSchedulerSubTickBudgetMs({
      subTickCapMs: PORTFOLIO_CAP,
      remainingMs: WALL,
      objectiveReservationMs: reserved,
    })
    assert.ok(portfolioBudget > 0)
  }
  console.log("  ✓ scenario 4 — 50 selected objectives bounded; portfolio not zeroed at tick start")

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts")
  const orchestratorSource = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")

  assert.match(schedulerSource, /tickAutonomousPortfolioManagerForScheduler[\s\S]*runObjectiveSchedulerWork/s)
  assert.doesNotMatch(portfolioSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  assert.doesNotMatch(schedulerSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  assert.match(orchestratorSource, /syncMissionRuntimeFromCanonicalDiscovery/)
  console.log("  ✓ regression — ordering and single sync authority preserved")

  console.log(`\n[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
