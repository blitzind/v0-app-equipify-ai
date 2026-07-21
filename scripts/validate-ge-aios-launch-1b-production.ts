/**
 * GE-AIOS-LAUNCH-1B — Production runtime trust validation (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-launch-1b-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { resolveCanonicalApprovalQueueCount } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER } from "@/lib/growth/home/growth-home-runtime-trust-types-1b"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { buildAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"

const PHASE = "GE-AIOS-LAUNCH-1B" as const

type Gate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production runtime trust validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  const workspaceSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: bootstrap.operatorEmail,
    actorUserId: bootstrap.actorUserId,
  })

  const briefing = synthesizeGrowthHomeExecutiveBriefing({
    dashboard: workspaceSummary.dashboard,
    sources: workspaceSummary.sources,
    canonicalApprovalSnapshot: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
    missionDiscovery: workspaceSummary.missionDiscovery,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.operator?.currentActiveCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.operator?.targetActiveCompanies ?? null,
  })

  const aiOsUx = buildAiOsUxViewModel({
    dashboard: workspaceSummary.dashboard,
    executiveBrief: briefing.executiveBrief,
    waitingOnYou: briefing.waitingOnYou,
    waitingOnYouOverflow: briefing.waitingOnYouOverflow,
    needsReview: briefing.needsReview,
    canonicalApprovalSnapshot: workspaceSummary.canonicalOperatorApproval,
    canonicalOperatorTask: workspaceSummary.canonicalOperatorTask,
    canonicalActiveMissions: workspaceSummary.canonicalActiveMissions,
    canonicalOperatorFocus: workspaceSummary.canonicalOperatorFocus,
    missionDiscovery: workspaceSummary.missionDiscovery,
    portfolioTargetCurrent: workspaceSummary.portfolioManager?.operator?.currentActiveCompanies ?? null,
    portfolioTargetGoal: workspaceSummary.portfolioManager?.operator?.targetActiveCompanies ?? null,
  })

  const canonicalApprovalCount = resolveCanonicalApprovalQueueCount(
    workspaceSummary.canonicalOperatorApproval,
    0,
  )

  const activeWork = briefing.dailyBriefing?.work_manager_result?.active_work ?? null
  const setupIncomplete = briefing.dailyBriefing?.daily_activity_narrative?.focus === "setup"

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: workspaceSummary.runtimeTrust ?? null,
    salesOutcomes: workspaceSummary.salesOutcomes,
    activeWork,
    pendingApprovals: canonicalApprovalCount,
    setupIncomplete,
    missionDiscovery: workspaceSummary.missionDiscovery,
    generatedAt: workspaceSummary.generatedAt,
  })

  pushGate(gates, {
    id: "runtime_trust_payload_loaded",
    status: workspaceSummary.runtimeTrust?.qaMarker === GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER ? "pass" : "fail",
    detail: workspaceSummary.runtimeTrust
      ? `marker=${workspaceSummary.runtimeTrust.qaMarker}; scheduler=${workspaceSummary.runtimeTrust.lastSchedulerRunAt ?? "none"}`
      : "runtimeTrust missing from workspace summary",
  })

  pushGate(gates, {
    id: "runtime_trust_view_model",
    status: runtimeTrust.qaMarker === GROWTH_HOME_RUNTIME_TRUST_1B_QA_MARKER ? "pass" : "fail",
    detail: `state=${runtimeTrust.operatorState}; start=${runtimeTrust.startStatus.mode}`,
  })

  pushGate(gates, {
    id: "start_status_has_clear_action_or_active",
    status:
      runtimeTrust.startStatus.mode === "autonomous_active" ||
      (runtimeTrust.startStatus.primaryActionLabel != null && runtimeTrust.startStatus.primaryActionHref != null)
        ? "pass"
        : "fail",
    detail: `mode=${runtimeTrust.startStatus.mode}; action=${runtimeTrust.startStatus.primaryActionLabel ?? "none"}`,
  })

  const autonomyEnabled = workspaceSummary.runtimeTrust?.killSwitches?.autonomy_enabled === true
  const claimsWorking = runtimeTrust.operatorState === "working"
  const hasActiveWork = activeWork?.status === "working"
  const hasRecentOutcome = (workspaceSummary.salesOutcomes.outcomes[0]?.completed_at ?? null) != null

  pushGate(gates, {
    id: "working_state_requires_evidence",
    status: claimsWorking && !hasActiveWork && !hasRecentOutcome ? "warn" : "pass",
    detail: `working=${claimsWorking}; activeWork=${hasActiveWork}; recentOutcome=${hasRecentOutcome}`,
  })

  pushGate(gates, {
    id: "blocked_when_autonomy_disabled",
    status:
      !autonomyEnabled && runtimeTrust.operatorState === "working"
        ? "fail"
        : !autonomyEnabled &&
            (runtimeTrust.operatorState === "idle" ||
              runtimeTrust.operatorState === "blocked" ||
              runtimeTrust.startStatus.mode === "autonomous_paused")
          ? "pass"
          : autonomyEnabled
            ? "pass"
            : "warn",
    detail: `autonomy=${autonomyEnabled}; state=${runtimeTrust.operatorState}`,
  })

  pushGate(gates, {
    id: "activity_feed_from_real_outcomes_only",
    status:
      runtimeTrust.activityFeed.length === 0 ||
      runtimeTrust.activityFeed.every((row) =>
        workspaceSummary.salesOutcomes.outcomes.some(
          (outcome) => outcome.completed_at === row.occurredAt,
        ),
      )
        ? "pass"
        : "fail",
    detail: `feed=${runtimeTrust.activityFeed.length}; outcomes=${workspaceSummary.salesOutcomes.outcomes.length}`,
  })

  pushGate(gates, {
    id: "heartbeat_from_scheduler_telemetry",
    status:
      workspaceSummary.runtimeTrust?.lastSchedulerRunAt != null
        ? runtimeTrust.heartbeat.some((row) => row.id === "last-scheduler-cycle")
          ? "pass"
          : "warn"
        : "warn",
    detail: `schedulerRun=${workspaceSummary.runtimeTrust?.lastSchedulerRunAt ?? "none"}; heartbeat=${runtimeTrust.heartbeat.length}`,
  })

  pushGate(gates, {
    id: "kpi_live_status_not_required",
    status: aiOsUx.liveStatus != null ? "warn" : "pass",
    detail: aiOsUx.liveStatus
      ? "legacy KPI liveStatus still synthesized — Home should use runtimeTrust section"
      : "legacy liveStatus absent (expected)",
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const warnCount = gates.filter((row) => row.status === "warn").length
  const passCount = gates.filter((row) => row.status === "pass").length
  const score = Math.round((passCount / gates.length) * 100)

  console.log("")
  console.log(`[${PHASE}] org=${organizationId}`)
  console.log(`[${PHASE}] Runtime trust score: ${score}/100 (${passCount} pass, ${warnCount} warn, ${failCount} fail)`)
  console.log(`[${PHASE}] Operator state: ${runtimeTrust.operatorStateLabel}`)
  console.log(`[${PHASE}] Start mode: ${runtimeTrust.startStatus.mode} — ${runtimeTrust.startStatus.headline}`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
