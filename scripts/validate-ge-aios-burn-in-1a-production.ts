/**
 * GE-AIOS-BURN-IN-1A — Production burn-in validation (read-only + optional immediate tick probe).
 *
 * Run:
 *   pnpm validate:ge-aios-burn-in-1a-production
 *   pnpm validate:ge-aios-burn-in-1a-production -- --probe-immediate-tick
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"
import { runGrowthAvaActivationImmediateProductionTick } from "@/lib/growth/ava-activation/growth-ava-activation-immediate-tick-burn-in-1a"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

const PHASE = "GE-AIOS-BURN-IN-1A" as const
const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

async function main(): Promise<void> {
  const probeImmediateTick = process.argv.includes("--probe-immediate-tick")
  console.log(`[${PHASE}] Production burn-in validation (read-only${probeImmediateTick ? ", immediate tick probe" : ""})`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "burn-in@equipify.ai",
    actorUserId: CERT_ACTOR_USER_ID,
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  pushGate(gates, {
    id: "autonomy_enabled",
    status: killSwitches.autonomy_enabled ? "pass" : "fail",
    detail: `autonomy_enabled=${killSwitches.autonomy_enabled}`,
  })
  pushGate(gates, {
    id: "objective_mode_enabled",
    status: killSwitches.autonomy_objective_mode_enabled ? "pass" : "fail",
    detail: `autonomy_objective_mode_enabled=${killSwitches.autonomy_objective_mode_enabled}`,
  })

  const schedulerRuns = await listRecentGrowthCronExecutionRuns(admin, {
    cronRoute: growthCronApiPath("growth-objective-runtime-scheduler"),
    limit: 3,
  })
  pushGate(gates, {
    id: "scheduler_recently_ran",
    status: schedulerRuns.length > 0 && schedulerRuns[0]?.ok ? "pass" : "warn",
    detail: schedulerRuns[0]?.finishedAt ?? "no recent run",
  })

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: summary.runtimeTrust ?? null,
    salesOutcomes: summary.salesOutcomes,
    activeWork: null,
    pendingApprovals: summary.kpis.approvalQueueCount,
    setupIncomplete: false,
    missionDiscovery: summary.missionDiscovery,
    activation: summary.avaActivation ?? null,
    generatedAt: summary.generatedAt,
  })

  pushGate(gates, {
    id: "home_employee_mode_or_activation_path",
    status:
      runtimeTrust.employeeMode || runtimeTrust.showActivationScreen || runtimeTrust.startStatus.mode === "activation_required"
        ? "pass"
        : "warn",
    detail: `employeeMode=${runtimeTrust.employeeMode}; mode=${runtimeTrust.startStatus.mode}`,
  })

  pushGate(gates, {
    id: "activity_feed_not_simulated",
    status:
      runtimeTrust.activityFeed.length === 0 ||
      runtimeTrust.activityFeed.every((row) =>
        summary.salesOutcomes.outcomes.some((outcome) => outcome.completed_at === row.occurredAt),
      )
        ? "pass"
        : "fail",
    detail: `feed=${runtimeTrust.activityFeed.length}`,
  })

  if (probeImmediateTick) {
    const tick = await runGrowthAvaActivationImmediateProductionTick({ admin, organizationId })
    pushGate(gates, {
      id: "immediate_tick_ran",
      status: tick.qaMarker === GROWTH_AVA_BURN_IN_1A_IMMEDIATE_TICK_QA_MARKER && tick.schedulerRan ? "pass" : "fail",
      detail: `executed=${tick.organizationsExecuted}; outcomes=${tick.outcomesCompleted}; stop=${tick.stopReason ?? "none"}`,
    })
    if (tick.operatorLines.length > 0) {
      console.log("\n  Immediate tick operator lines:")
      for (const line of tick.operatorLines) console.log(`    • ${line}`)
    }
  } else {
    pushGate(gates, {
      id: "immediate_tick_wiring",
      status: "pass",
      detail: "Use --probe-immediate-tick to run live scheduler once (side effect)",
    })
  }

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  console.log(`\n[${PHASE}] org=${organizationId}`)
  console.log(`[${PHASE}] Burn-in readiness score: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(`[${PHASE}] Operator state: ${runtimeTrust.operatorStateLabel}`)
  console.log(`[${PHASE}] Recommendation: ${failCount === 0 ? "Begin 7-day burn-in as operator" : "Fix P0 gates before burn-in"}`)

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
