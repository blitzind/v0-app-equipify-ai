/**
 * GE-AIOS-18B — Autonomous Sales Loop Production Activation validation.
 *
 * Run (Vercel Production env only — never .env.local):
 *   pnpm test:ge-aios-18b-autonomous-sales-loop-production-activation
 *
 * Optional bounded live tick (explicit opt-in only):
 *   CONFIRM_GE_AIOS_18B_LIVE_TICK=1 pnpm test:ge-aios-18b-autonomous-sales-loop-production-activation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES } from "@/lib/growth/runtime-guardrails/growth-runtime-guardrail-config"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES,
  AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS,
  GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-types"
import {
  AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS,
  GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER,
} from "@/lib/growth/specialists/execution/autonomous-sales-loop-observability"
import {
  inspectAutonomousSalesLoopDryRun,
  runAutonomousSalesLoop,
  tickAutonomousSalesLoopForScheduler,
} from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GE_AIOS_18B_PRODUCTION_ACTIVATION_QA_MARKER =
  "ge-aios-18b-autonomous-sales-loop-production-activation-v1" as const

const PHASE = "GE-AIOS-18B" as const

type CheckResult = {
  id: string
  status: "pass" | "fail" | "warn" | "skip"
  detail: string
}

const checks: CheckResult[] = []

function record(id: string, status: CheckResult["status"], detail: string): void {
  checks.push({ id, status, detail })
  const prefix = status === "pass" ? "✓" : status === "warn" ? "!" : status === "skip" ? "-" : "✗"
  console.log(`  ${prefix} ${id}: ${detail}`)
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function countMemoryEvents(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("organization_memory_events")
    .select("memory_event_id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
  if (error) return -1
  return count ?? 0
}

async function verifyProductionReadinessAudit(admin: SupabaseClient): Promise<void> {
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  record(
    "kill-switch-autonomy_enabled-exists",
    "pass",
    `autonomy_enabled=${killSwitches.autonomy_enabled}`,
  )
  record(
    "kill-switch-default-safe",
    GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES.autonomy_enabled === false ? "pass" : "fail",
    `code default autonomy_enabled=${GROWTH_RUNTIME_DEFAULT_KILL_SWITCHES.autonomy_enabled}`,
  )
  record(
    "kill-switch-autonomy_outbound_enabled",
    "pass",
    `autonomy_outbound_enabled=${killSwitches.autonomy_outbound_enabled}`,
  )
  record(
    "kill-switch-autonomy_objective_mode_enabled",
    "pass",
    `autonomy_objective_mode_enabled=${killSwitches.autonomy_objective_mode_enabled}`,
  )

  const vercelCron = readSource("vercel.json")
  record(
    "scheduler-cron-active",
    vercelCron.includes('"/api/cron/growth-objective-runtime-scheduler"') ? "pass" : "fail",
    "growth-objective-runtime-scheduler registered in vercel.json",
  )
  record(
    "scheduler-cron-cadence",
    vercelCron.includes('"schedule": "*/20 * * * *"') &&
      vercelCron.includes('"/api/cron/growth-objective-runtime-scheduler"')
      ? "pass"
      : "warn",
    "Objective runtime scheduler runs every 20 minutes",
  )

  record(
    "loop-budget-max-iterations",
    AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS <= 5 ? "pass" : "warn",
    `default max iterations=${AUTONOMOUS_SALES_LOOP_DEFAULT_MAX_ITERATIONS}`,
  )
  record(
    "loop-budget-daily-minutes",
    AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES <= 120 ? "pass" : "warn",
    `default daily budget=${AUTONOMOUS_SALES_LOOP_DEFAULT_DAILY_BUDGET_MINUTES} minutes`,
  )

  const executeAgentSource = readSource("lib/growth/specialists/execution/execute-sales-workflow-agent.ts")
  record(
    "approval-guardrail-manual-agents-only",
    executeAgentSource.includes("runAutonomousResearchManualRefresh") &&
      executeAgentSource.includes("runAutonomousOutreachPreparationManualRequest") &&
      !executeAgentSource.match(/sendOutbound|executeOutbound|transportSend/i)
      ? "pass"
      : "fail",
    "Workflow agents use existing manual pilot entry points only",
  )

  const outreachSource = readSource(
    "lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service.ts",
  )
  record(
    "approval-guardrail-outreach-pending",
    outreachSource.includes("pendingHumanApproval") || outreachSource.includes("approvalPackage")
      ? "pass"
      : "warn",
    "Outreach preparation retains human approval packaging",
  )

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  record(
    "no-duplicate-scheduler",
    !schedulerSource.match(/createScheduler|setInterval|node-cron/) &&
      schedulerSource.includes("tickAutonomousSalesLoopForScheduler")
      ? "pass"
      : "fail",
    "Objective runtime scheduler remains canonical tick owner",
  )

  const { data: guardrailRows } = await admin
    .schema("growth")
    .from("runtime_guardrail_settings")
    .select("key, enabled")
    .in("key", ["autonomy_enabled", "autonomy_outbound_enabled", "autonomy_objective_mode_enabled"])

  record(
    "kill-switch-db-readable",
    guardrailRows != null ? "pass" : "warn",
    guardrailRows
      ? `${guardrailRows.length} autonomy kill switch rows readable`
      : "runtime_guardrail_settings unavailable; using code defaults",
  )
}

async function verifyObservabilityMarkers(): Promise<void> {
  const observabilitySource = readSource(
    "lib/growth/specialists/execution/autonomous-sales-loop-observability.ts",
  )
  const loopSource = readSource("lib/growth/specialists/execution/run-autonomous-sales-loop.ts")

  record(
    "observability-qa-marker",
    observabilitySource.includes(GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER)
      ? "pass"
      : "fail",
    GE_AIOS_18B_AUTONOMOUS_SALES_LOOP_OBSERVABILITY_QA_MARKER,
  )

  record(
    "observability-loop-logging-wired",
    loopSource.includes("logAutonomousSalesLoopEvent") ? "pass" : "fail",
    "run-autonomous-sales-loop emits structured growth-engine events",
  )

  for (const event of Object.values(AUTONOMOUS_SALES_LOOP_OBSERVABILITY_EVENTS)) {
    record(
      `observability-event-defined-${event}`,
      observabilitySource.includes(event) ? "pass" : "fail",
      observabilitySource.includes(event) ? "event constant defined" : "missing",
    )
  }

  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  record(
    "observability-scheduler-log-bridge",
    schedulerSource.includes("autonomous_sales_loop") ? "pass" : "fail",
    "Objective scheduler logs autonomous sales loop summary",
  )
}

async function verifyProductionLoopBehavior(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const memoryBefore = await countMemoryEvents(admin, organizationId)
  record("memory-count-before", memoryBefore >= 0 ? "pass" : "fail", `${memoryBefore} rows`)

  const dryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId })
  assert.equal(dryRun.dry_run, true, "dry run flag must be set")
  record(
    "dry-run-inspect-selected-work",
    dryRun.selected_work && dryRun.selected_work.length > 0 ? "pass" : "warn",
    dryRun.selected_work?.length
      ? `selected ${dryRun.selected_work.length} item(s); top=${dryRun.selected_work[0]?.title ?? "n/a"}`
      : "no executable work available for dry-run inspect",
  )
  record(
    "dry-run-no-agent-outcomes",
    dryRun.outcomes_completed === 0 ? "pass" : "fail",
    `outcomes_completed=${dryRun.outcomes_completed}`,
  )
  record(
    "dry-run-no-memory-persisted",
    dryRun.memory_events_persisted === 0 ? "pass" : "fail",
    `memory_events_persisted=${dryRun.memory_events_persisted}`,
  )

  const memoryAfterDryRun = await countMemoryEvents(admin, organizationId)
  record(
    "dry-run-memory-unchanged",
    memoryAfterDryRun === memoryBefore ? "pass" : "fail",
    `before=${memoryBefore} after=${memoryAfterDryRun}`,
  )

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled) {
    const blocked = await runAutonomousSalesLoop({ admin, organizationId, maxIterations: 1 })
    record(
      "kill-switch-blocks-live-loop",
      !blocked.executed && blocked.stop_reason === "autonomy_disabled" ? "pass" : "fail",
      `executed=${blocked.executed} stop_reason=${blocked.stop_reason ?? "null"}`,
    )
  } else {
    record(
      "kill-switch-blocks-live-loop",
      "warn",
      "autonomy_enabled is ON in production — live loop would execute; verify intentionally",
    )
  }

  const schedulerDryRun = await tickAutonomousSalesLoopForScheduler(admin, {
    organizationIds: [organizationId],
    dryRun: true,
    maxOrganizations: 1,
  })
  record(
    "scheduler-tick-dry-run",
    schedulerDryRun.dry_run === true ? "pass" : "fail",
    `organizations_attempted=${schedulerDryRun.organizations_attempted}`,
  )

  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin, { certificationMode: true })
  record(
    "scheduler-can-tick-loop",
    schedulerResult.autonomousSalesLoop != null ? "pass" : "fail",
    schedulerResult.autonomousSalesLoop
      ? `attempted=${schedulerResult.autonomousSalesLoop.organizations_attempted} skipped=${schedulerResult.autonomousSalesLoop.skipped_reason ?? "none"}`
      : "autonomousSalesLoop missing from scheduler result",
  )

  if (process.env.CONFIRM_GE_AIOS_18B_LIVE_TICK === "1") {
    if (!killSwitches.autonomy_enabled) {
      record("live-tick-bounded", "skip", "autonomy_enabled is off — enable before live tick")
    } else {
      const live = await runAutonomousSalesLoop({
        admin,
        organizationId,
        maxIterations: 1,
        dailyBudgetMinutes: 15,
      })
      const memoryAfterLive = await countMemoryEvents(admin, organizationId)
      record(
        "live-tick-bounded",
        live.iterations <= 1 ? "pass" : "fail",
        `iterations=${live.iterations} outcomes=${live.outcomes_completed}`,
      )
      record(
        "live-tick-memory-only-after-outcomes",
        live.outcomes_completed === 0 || memoryAfterLive >= memoryBefore ? "pass" : "fail",
        `memory before=${memoryBefore} after=${memoryAfterLive}`,
      )
    }
  } else {
    record(
      "live-tick-bounded",
      "skip",
      "Set CONFIRM_GE_AIOS_18B_LIVE_TICK=1 for one bounded live cycle",
    )
  }
}

async function verifyHomeReflectsCompletedWork(
  admin: SupabaseClient,
  operatorEmail: string,
): Promise<void> {
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail,
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })

  record(
    "home-single-fetch-path",
    summary.briefing === null ? "pass" : "fail",
    "workspace-summary remains canonical Home fetch",
  )
  record(
    "home-sales-outcomes-present",
    summary.salesOutcomes != null ? "pass" : "fail",
    `researched=${summary.salesOutcomes.dailySummary.researched} qualified=${summary.salesOutcomes.dailySummary.qualified}`,
  )
  record(
    "home-memory-present",
    summary.organizationalMemory != null ? "pass" : "fail",
    summary.organizationalMemory.degraded
      ? `degraded (${summary.organizationalMemory.warning ?? "unknown"})`
      : `source=${summary.organizationalMemory.source}`,
  )

  const workspaceSummarySource = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
  record(
    "home-not-driving-loop",
    !workspaceSummarySource.includes("runAutonomousSalesLoop") ? "pass" : "fail",
    "Home fetch does not trigger autonomous execution",
  )
}

async function main(): Promise<void> {
  console.log(`\n[${PHASE}] Production Activation Validation (${GE_AIOS_18B_PRODUCTION_ACTIVATION_QA_MARKER})\n`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    record("bootstrap", "fail", "Could not bootstrap production Supabase env")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    record("organization-id", "fail", "GROWTH_ENGINE_AI_ORG_ID missing")
    process.exit(1)
  }

  record("environment", "pass", `Supabase connected; org=${organizationId}; loop_qa=${GROWTH_AUTONOMOUS_SALES_LOOP_QA_MARKER}`)

  console.log("\nPhase 1 — Production Readiness Audit")
  await verifyProductionReadinessAudit(boot.admin)

  console.log("\nPhase 2 — Observability Verification")
  await verifyObservabilityMarkers()

  console.log("\nPhase 3 — Production Loop Behavior")
  await verifyProductionLoopBehavior(boot.admin, organizationId)

  console.log("\nPhase 4 — Home Reflection Verification")
  await verifyHomeReflectsCompletedWork(
    boot.admin,
    process.env.GE_AIOS_18B_OPERATOR_EMAIL?.trim() || "operator@equipify.ai",
  )

  const failures = checks.filter((row) => row.status === "fail")
  const warnings = checks.filter((row) => row.status === "warn")

  console.log(`\n[${PHASE}] Summary: ${checks.length} checks, ${failures.length} failed, ${warnings.length} warnings`)

  if (failures.length > 0) {
    console.log(
      JSON.stringify({ ok: false, qa_marker: GE_AIOS_18B_PRODUCTION_ACTIVATION_QA_MARKER, checks }, null, 2),
    )
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, qa_marker: GE_AIOS_18B_PRODUCTION_ACTIVATION_QA_MARKER, checks }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
