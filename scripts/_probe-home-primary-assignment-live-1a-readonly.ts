/**
 * GE-AIOS-HOME-PRIMARY-ASSIGNMENT-LIVE-1A / RUNTIME-AUTHORITY-1B — read-only production audit probe.
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"

const SLUSS_LEAD = "3caafb29-1f9d-4569-99dd-44f4cecf9049"

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("Run via vercel-production-env-run.ts")
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "runtime-authority-probe@equipify.ai",
    actorUserId: "home-runtime-authority-1b-probe",
  })

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: summary.runtimeTrust ?? null,
    salesOutcomes: summary.salesOutcomes ?? null,
    activeWork: null,
    pendingApprovals: summary.operatorTasks.pendingApprovals ?? 0,
    setupIncomplete: false,
    missionDiscovery: summary.missionDiscovery ?? null,
    activation: summary.avaActivation ?? null,
    generatedAt: summary.generatedAt,
    canonicalOperatorFocus: summary.canonicalOperatorFocus ?? null,
    operatorApprovalCompanyName: summary.canonicalOperatorApproval?.topPackage?.companyName ?? null,
    portfolioOperator: summary.portfolioManager?.operator ?? null,
    productionMissionAuthority: summary.productionMissionAuthority ?? null,
  })

  const topQueueItem = summary.dailyRevenueWorkQueue?.display?.top_items?.[0] ?? null
  const schedulerRuns = await listRecentGrowthCronExecutionRuns(admin, {
    cronRoute: growthCronApiPath("growth-objective-runtime-scheduler"),
    limit: 3,
  })

  const { data: slussLead } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, status, metadata, last_prospect_researched_at, updated_at")
    .eq("id", SLUSS_LEAD)
    .maybeSingle()

  const { data: activeResearch } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, company_name, status, created_at, started_at, updated_at")
    .eq("organization_id", orgId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: dmRuns } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, status, run_name, last_polled_at, completed_at, created_at, provider_metadata")
    .like("run_name", "ge-aios-autonomous-prospect-search:%")
    .order("created_at", { ascending: false })
    .limit(5)

  const runtimeMissionDiffersFromOperatorFocus =
    runtimeTrust.primaryMissionLabel != null &&
    runtimeTrust.operatorFocusCompanyName != null &&
    runtimeTrust.currentLeadCompanyName == null &&
    runtimeTrust.primaryMissionLabel !== runtimeTrust.operatorFocusCompanyName

  console.log(
    JSON.stringify(
      {
        phase: "GE-AIOS-HOME-RUNTIME-AUTHORITY-1B",
        captured_at: summary.generatedAt,
        org_id: orgId,
        env_source: boot.env_source,
        scheduler_recent: schedulerRuns.map((row) => ({
          started_at: row.startedAt,
          ok: row.ok,
        })),
        runtime_authority: {
          primary_mission: runtimeTrust.primaryMissionLabel,
          primary_mission_kind: runtimeTrust.primaryMissionKind,
          current_activity: runtimeTrust.currentActivityLabel,
          current_activity_scope: runtimeTrust.currentActivityScope,
          current_lead: runtimeTrust.currentLeadCompanyName,
          operator_focus: runtimeTrust.operatorFocusCompanyName,
          operator_focus_href: runtimeTrust.operatorFocusHref,
          deprecated_primary_company_name: runtimeTrust.primaryCompanyName,
          runtime_mission_differs_from_operator_focus: runtimeMissionDiffersFromOperatorFocus,
        },
        canonical_operator_focus: summary.canonicalOperatorFocus
          ? {
              lead_id: summary.canonicalOperatorFocus.leadId,
              company_name: summary.canonicalOperatorFocus.companyName,
              source: summary.canonicalOperatorFocus.source,
            }
          : null,
        revenue_queue_top: topQueueItem
          ? {
              lead_id: topQueueItem.lead_id,
              action_label: topQueueItem.action_label,
            }
          : null,
        mission_discovery: summary.missionDiscovery
          ? {
              discovery_action: summary.missionDiscovery.discoveryAction,
              activity_label: summary.missionDiscovery.activityLabel,
            }
          : null,
        production_mission_authority: summary.productionMissionAuthority
          ? {
              primary_focus: summary.productionMissionAuthority.primaryFocus,
              discovery_active: summary.productionMissionAuthority.discoveryActive,
            }
          : null,
        portfolio_operator: summary.portfolioManager?.operator
          ? {
              discovery_running: summary.portfolioManager.operator.discoveryRunning,
              discovery_status_display: summary.portfolioManager.operator.discoveryStatusDisplay,
            }
          : null,
        sluss_lead: slussLead
          ? {
              id: slussLead.id,
              company: slussLead.company_name,
              status: slussLead.status,
            }
          : null,
        active_research_runs: (activeResearch ?? []).map((row) => ({
          id: row.id,
          company: row.company_name,
          status: row.status,
        })),
        datamoon_runs: (dmRuns ?? []).slice(0, 3).map((row) => ({
          id: row.id,
          status: row.status,
          last_polled_at: row.last_polled_at,
        })),
        verification: {
          portfolio_execution_must_not_use_revenue_queue_as_runtime_lead:
            runtimeTrust.currentActivityScope === "portfolio"
              ? runtimeTrust.currentLeadCompanyName == null
              : null,
          operator_focus_may_still_be_revenue_queue_lead: runtimeTrust.operatorFocusCompanyName,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
