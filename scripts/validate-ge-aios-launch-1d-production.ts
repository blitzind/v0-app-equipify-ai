/**
 * GE-AIOS-LAUNCH-1D — Production runtime completion validation (read-only).
 *
 * Run: pnpm validate:ge-aios-launch-1d-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER } from "@/lib/growth/specialists/execution/growth-asl-discovery-mission-work-items-launch-1d"
import { routeWorkItem } from "@/lib/growth/specialists/router/route-work-item"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

const PHASE = "GE-AIOS-LAUNCH-1D" as const
const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

function sampleDiscoveryWorkItem(): AvaWorkItem {
  return {
    id: "work:discovery:refresh_audience",
    type: "mission",
    title: "Refresh audience — Production ICP",
    description: null,
    status: "ready",
    priority: 90,
    source: "decision_engine",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_minutes: 10,
    estimated_revenue_impact: 60,
    requires_operator: false,
    can_execute_autonomously: true,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 90,
    confidence: 80,
    href: null,
    company_name: null,
    decision_source_id: "discovery:refresh_audience",
    relationship_graph: null,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production runtime completion validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  pushGate(gates, {
    id: "discovery_qa_marker",
    status: GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER ? "pass" : "fail",
    detail: GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER,
  })

  const routed = routeWorkItem(sampleDiscoveryWorkItem())
  pushGate(gates, {
    id: "discovery_not_marketing_stub",
    status: routed.specialist_id === "sales" ? "pass" : "fail",
    detail: `refresh_audience routed to ${routed.specialist_id}`,
  })

  const autonomy = await fetchGrowthAutonomySettings(admin, organizationId)
  pushGate(gates, {
    id: "research_budget_enabled",
    status:
      autonomy.dailyBudgetLimits.autonomous_research_runs > 0 && autonomy.capabilityToggles.research
        ? "pass"
        : "warn",
    detail: `cap=${autonomy.dailyBudgetLimits.autonomous_research_runs}; toggle=${autonomy.capabilityToggles.research}`,
  })

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  pushGate(gates, {
    id: "autonomy_on",
    status: killSwitches.autonomy_enabled && killSwitches.autonomy_objective_mode_enabled ? "pass" : "fail",
    detail: `autonomy=${killSwitches.autonomy_enabled}; objective=${killSwitches.autonomy_objective_mode_enabled}`,
  })

  const schedulerRuns = await listRecentGrowthCronExecutionRuns(admin, {
    cronRoute: growthCronApiPath("growth-objective-runtime-scheduler"),
    limit: 1,
  })
  pushGate(gates, {
    id: "scheduler_healthy",
    status: schedulerRuns[0]?.ok ? "pass" : "warn",
    detail: schedulerRuns[0]?.finishedAt ?? "no recent run",
  })

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "launch-1d@equipify.ai",
    actorUserId: CERT_ACTOR_USER_ID,
  })

  const salesOutcomesTimedOut =
    summary.optimization.stageTimingsMs?.sales_outcomes != null &&
    summary.optimization.stageTimingsMs.sales_outcomes >= 5_999
  pushGate(gates, {
    id: "sales_outcomes_loader",
    status: summary.salesOutcomes.outcomes.length > 0 || !salesOutcomesTimedOut ? "pass" : "warn",
    detail: `outcomes=${summary.salesOutcomes.outcomes.length}; ms=${summary.optimization.stageTimingsMs?.sales_outcomes ?? "n/a"}`,
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
    id: "runtime_trust_loaded",
    status: runtimeTrust.operatorState !== "idle" || summary.runtimeTrust != null ? "pass" : "warn",
    detail: `state=${runtimeTrust.operatorStateLabel}`,
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  console.log(`\n[${PHASE}] org=${organizationId}`)
  console.log(`[${PHASE}] Runtime completion score: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(
    `[${PHASE}] Recommendation: ${failCount === 0 ? "Continue burn-in — stub path removed" : "Fix failing gates before burn-in"}`,
  )

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
