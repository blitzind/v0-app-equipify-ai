/**
 * GE-AIOS-LIVE-5C — Scheduler budget reservation clamp production validation.
 *
 * Run:
 *   pnpm validate:ge-aios-live-5c-budget-clamp-production
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import {
  GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER,
  resolveSchedulerObjectiveExecutionReservationCapMs,
  resolveSchedulerObjectiveExecutionReservationMs,
  resolveSchedulerSubTickBudgetMs,
} from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
} from "@/lib/growth/relationship/relationship-scale-limits"

const PHASE = "GE-AIOS-LIVE-5C" as const

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "inconclusive"
  detail: string
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Scheduler budget reservation clamp production validation`)
  console.log(`QA marker: ${GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER}`)

  const gates: ValidationGate[] = []
  const budgetSource = readSource("lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a.ts")
  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  const portfolioSource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts")
  const orchestratorSource = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")

  const reservationCap = resolveSchedulerObjectiveExecutionReservationCapMs()
  const wall = GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS
  const portfolioCap = GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs

  gates.push({
    id: "reservation_derives_from_existing_constants",
    status:
      budgetSource.includes("resolveSchedulerObjectiveExecutionReservationCapMs") &&
      budgetSource.includes("GROWTH_OBJECTIVE_SCHEDULER_MAX_RUNTIME_MS") &&
      budgetSource.includes("portfolioManagerMs") &&
      !budgetSource.includes("20_000")
        ? "pass"
        : "fail",
    detail: `cap=${reservationCap}ms from wall(${wall}) - portfolioCap(${portfolioCap})`,
  })

  gates.push({
    id: "reservation_never_exceeds_scheduler_wall",
    status: [1, 4, 10, 50].every(
      (n) => resolveSchedulerObjectiveExecutionReservationMs(n) <= wall,
    )
      ? "pass"
      : "fail",
    detail: `maxReservationAt50=${resolveSchedulerObjectiveExecutionReservationMs(50)} wall=${wall}`,
  })

  gates.push({
    id: "portfolio_retains_executable_budget",
    status:
      resolveSchedulerSubTickBudgetMs({
        subTickCapMs: portfolioCap,
        remainingMs: wall,
        objectiveReservationMs: resolveSchedulerObjectiveExecutionReservationMs(50),
      }) > 0
        ? "pass"
        : "fail",
    detail: `portfolioBudgetAtStart=${resolveSchedulerSubTickBudgetMs({
      subTickCapMs: portfolioCap,
      remainingMs: wall,
      objectiveReservationMs: resolveSchedulerObjectiveExecutionReservationMs(50),
    })}`,
  })

  gates.push({
    id: "objective_loop_retains_executable_budget",
    status: reservationCap >= GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS ? "pass" : "fail",
    detail: `reservationCap=${reservationCap} objectiveTimeout=${GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS}`,
  })

  gates.push({
    id: "mission_sync_authority_unchanged",
    status:
      orchestratorSource.includes("syncMissionRuntimeFromCanonicalDiscovery") &&
      !portfolioSource.includes("syncMissionRuntimeFromCanonicalDiscovery") &&
      !schedulerSource.includes("syncMissionRuntimeFromCanonicalDiscovery")
        ? "pass"
        : "fail",
    detail: "Mission sync remains in runGrowthMissionRuntimeOrchestration only.",
  })

  gates.push({
    id: "scheduler_ordering_unchanged",
    status:
      schedulerSource.indexOf("tickAutonomousPortfolioManagerForScheduler") <
      schedulerSource.indexOf("runObjectiveSchedulerWork")
        ? "pass"
        : "fail",
    detail: "Portfolio sub-tick still precedes objective loop.",
  })

  gates.push({
    id: "no_duplicate_orchestration_paths",
    status:
      !portfolioSource.includes("runGrowthMissionRuntimeOrchestration") &&
      schedulerSource.includes("runGrowthMissionRuntimeOrchestration")
        ? "pass"
        : "fail",
    detail: "Single orchestration entry via objective scheduler work.",
  })

  gates.push({
    id: "no_new_runtime_configuration",
    status:
      budgetSource.includes("GROWTH_AIOS_LIVE_5C_SCHEDULER_BUDGET_CLAMP_QA_MARKER") &&
      budgetSource.includes("resolveSchedulerObjectiveExecutionReservationCapMs")
        ? "pass"
        : "fail",
    detail: "Clamp reuses existing scheduler constants; no new tuning values.",
  })

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    gates.push({
      id: "production_bootstrap",
      status: "fail",
      detail: "Production bootstrap unavailable.",
    })
    printGates(gates)
    process.exit(1)
  }

  const killSwitches = await getRuntimeKillSwitchStates(bootstrap.admin)
  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  })

  gates.push({
    id: "live_5a_wiring_preserved",
    status:
      schedulerSource.includes("resolveSchedulerObjectiveExecutionReservationMs") &&
      schedulerSource.includes("resolveSchedulerSubTickBudgetMs") &&
      schedulerSource.includes("portfolioBudgetMs")
        ? "pass"
        : "fail",
    detail: "LIVE-5A reservation wiring remains intact with LIVE-5C clamp.",
  })

  printGates(gates)

  if (gates.some((gate) => gate.status === "fail")) {
    process.exit(1)
  }
}

function printGates(gates: ValidationGate[]): void {
  for (const gate of gates) {
    console.log(`[${gate.status.toUpperCase()}] ${gate.id}: ${gate.detail}`)
  }
  const passed = gates.filter((gate) => gate.status === "pass").length
  console.log(`\n[${PHASE}] ${passed}/${gates.length} gates passed`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
