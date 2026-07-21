/**
 * GE-AIOS-LIVE-5A — Scheduler budget reservation production validation.
 *
 * Run:
 *   pnpm validate:ge-aios-live-5a-scheduler-budget-reservation-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { loadGrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-loader"
import { GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER } from "@/lib/growth/runtime-guardrails/growth-scheduler-runtime-budget-1a"
import { GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A } from "@/lib/growth/objectives/growth-objective-scheduler-telemetry-1a-types"
import {
  filterSchedulerEligibleObjectives,
  selectSchedulerObjectivesWithOrgFairness,
} from "@/lib/growth/objectives/growth-objective-scheduler-selection-1a"
import {
  isObjectiveSchedulerBackoffElapsed,
} from "@/lib/growth/objectives/growth-objective-scheduler-retry-1a"
import {
  getGrowthObjective,
  listEligibleGrowthObjectivesForSchedulerTick,
} from "@/lib/growth/objectives/growth-objective-repository"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
} from "@/lib/growth/relationship/relationship-scale-limits"

const PHASE = "GE-AIOS-LIVE-5A" as const
const MISSION_ID = "91eecd92-b6c4-4c3e-8fb3-eefc499e9cf6"
const SCHEDULER_ROUTE = growthCronApiPath("growth-objective-runtime-scheduler")

type ValidationGate = {
  id: string
  status: "pass" | "warn" | "fail" | "inconclusive"
  detail: string
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Scheduler budget reservation production validation`)
  console.log(`QA marker: ${GROWTH_AIOS_LIVE_5A_SCHEDULER_BUDGET_RESERVATION_QA_MARKER}`)

  const gates: ValidationGate[] = []
  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  const portfolioSource = readSource(
    "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  )
  const orchestratorSource = readSource("lib/growth/mission-center/growth-mission-runtime-orchestrator.ts")

  gates.push({
    id: "scheduler_objective_reservation_wired",
    status:
      schedulerSource.includes("resolveSchedulerObjectiveExecutionReservationMs") &&
      schedulerSource.includes("resolveSchedulerSubTickBudgetMs") &&
      schedulerSource.includes("portfolioManagerMs")
        ? "pass"
        : "fail",
    detail: "Scheduler reserves objective execution window and caps portfolio sub-tick budget.",
  })

  gates.push({
    id: "portfolio_bounded_runtime",
    status:
      portfolioSource.includes("maxRuntimeMs") &&
      portfolioSource.includes("Date.now() - startedAt >= maxRuntimeMs")
        ? "pass"
        : "fail",
    detail: "Portfolio manager scheduler tick honors maxRuntimeMs like sales loop and draft factory.",
  })

  gates.push({
    id: "single_sync_authority",
    status:
      orchestratorSource.includes("syncMissionRuntimeFromCanonicalDiscovery") &&
      orchestratorSource.includes("persistMissionRuntime") &&
      !portfolioSource.includes("syncMissionRuntimeFromCanonicalDiscovery") &&
      !schedulerSource.includes("syncMissionRuntimeFromCanonicalDiscovery")
        ? "pass"
        : "fail",
    detail: "Mission sync remains exclusively in runGrowthMissionRuntimeOrchestration().",
  })

  gates.push({
    id: "no_duplicate_orchestration_path",
    status:
      !portfolioSource.includes("runGrowthMissionRuntimeOrchestration") &&
      schedulerSource.includes("runGrowthMissionRuntimeOrchestration")
        ? "pass"
        : "fail",
    detail: "Only objective scheduler work invokes mission orchestration.",
  })

  gates.push({
    id: "portfolio_budget_cap_configured",
    status:
      GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs === 25_000 ? "pass" : "fail",
    detail: `portfolioManagerMs=${GROWTH_SCHEDULER_RUNTIME_CALL_GRAPH_1A.budgets.portfolioManagerMs}`,
  })

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    gates.push({
      id: "production_bootstrap",
      status: "fail",
      detail: "Production bootstrap unavailable — run via vercel-production-env-run.ts",
    })
    printGates(gates)
    process.exit(1)
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const [mission, missionDiscovery, killSwitches, cronRuns, fetchedObjectives] = await Promise.all([
    getGrowthObjective(admin, organizationId, MISSION_ID),
    loadGrowthHomeMissionDiscoverySnapshot(admin, { organizationId }),
    getRuntimeKillSwitchStates(admin),
    listRecentGrowthCronExecutionRuns(admin, { cronRoute: SCHEDULER_ROUTE, limit: 10 }),
    listEligibleGrowthObjectivesForSchedulerTick(admin),
  ])

  const selection = selectSchedulerObjectivesWithOrgFairness(fetchedObjectives, {
    maxObjectives: GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
    maxOrganizations: GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
  })
  const missionSelected = selection.selected.some((row) => row.id === MISSION_ID)
  const missionEligible = filterSchedulerEligibleObjectives(fetchedObjectives).some(
    (row) => row.id === MISSION_ID,
  )
  const missionFetched = fetchedObjectives.some((row) => row.id === MISSION_ID)
  const missionBackoffElapsed = mission ? isObjectiveSchedulerBackoffElapsed(mission) : false

  gates.push({
    id: "mission_selected",
    status: missionSelected
      ? "pass"
      : missionEligible
        ? "warn"
        : missionFetched && mission?.status === "active"
          ? "warn"
          : "fail",
    detail: missionSelected
      ? `Mission ${MISSION_ID} is in current scheduler selection set (${selection.selected.length} selected).`
      : missionEligible
        ? `Mission eligible but not in current fairness slice (${selection.selected.length} selected).`
        : missionFetched && mission?.status === "active"
          ? `Mission fetched and active; scheduler backoff elapsed=${missionBackoffElapsed}.`
          : "Mission not present in scheduler fetch pool.",
  })

  gates.push({
    id: "outbound_disabled",
    status: killSwitches.autonomy_outbound_enabled === false ? "pass" : "fail",
    detail: `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  })

  gates.push({
    id: "mission_active",
    status: mission?.status === "active" && mission.runtime?.running ? "pass" : "fail",
    detail: mission
      ? `status=${mission.status} running=${mission.runtime?.running ?? false}`
      : "Mission not found.",
  })

  const lastSchedulerAt = mission?.runtime?.lastSchedulerAt ?? null
  const lastOrchestrationAt = mission?.executionContext?.missionRuntime?.lastOrchestrationAt ?? null
  const recordsImported = mission?.executionContext?.missionRuntime?.counters.recordsImported ?? 0
  const newCompaniesFound = mission?.executionContext?.missionRuntime?.counters.newCompaniesFound ?? 0
  const homeRecordsImported = missionDiscovery?.recordsImported ?? 0
  const homeNewCompaniesFound = missionDiscovery?.newCompaniesFound ?? 0

  const recentProcessedTick = cronRuns.find((run) => run.processedCount > 0) ?? null
  gates.push({
    id: "objective_loop_executed_recently",
    status: recentProcessedTick ? "pass" : "warn",
    detail: recentProcessedTick
      ? `Latest processed scheduler tick started ${recentProcessedTick.startedAt} processed=${recentProcessedTick.processedCount}.`
      : "No recent scheduler tick with processedCount>0 — deploy LIVE-5A and wait for next tick if post-fix proof is required.",
  })

  gates.push({
    id: "mission_orchestration_persisted",
    status:
      lastOrchestrationAt != null &&
      (lastSchedulerAt == null ||
        Date.parse(lastOrchestrationAt) >= Date.parse(lastSchedulerAt) - 60_000)
        ? recordsImported > 0 || newCompaniesFound > 0
          ? "pass"
          : "warn"
        : "warn",
    detail: `lastOrchestrationAt=${lastOrchestrationAt ?? "null"} lastSchedulerAt=${lastSchedulerAt ?? "null"} recordsImported=${recordsImported} newCompaniesFound=${newCompaniesFound}`,
  })

  gates.push({
    id: "home_projection_matches_mission_runtime",
    status:
      homeRecordsImported === recordsImported && homeNewCompaniesFound === newCompaniesFound
        ? recordsImported > 0 || newCompaniesFound > 0
          ? "pass"
          : "warn"
        : "warn",
    detail: `home recordsImported=${homeRecordsImported} newCompaniesFound=${homeNewCompaniesFound}; mission recordsImported=${recordsImported} newCompaniesFound=${newCompaniesFound}`,
  })

  gates.push({
    id: "objective_timeout_semantics_preserved",
    status:
      schedulerSource.includes("GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS") &&
      schedulerSource.includes("mayBeginWork(GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS)")
        ? "pass"
        : "fail",
    detail: `Objective loop still requires ${GROWTH_OBJECTIVE_SCHEDULER_OBJECTIVE_TIMEOUT_MS}ms via budget.mayBeginWork().`,
  })

  printGates(gates)

  const failures = gates.filter((gate) => gate.status === "fail")
  if (failures.length > 0) {
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
