/**
 * GE-AIOS-POST-DEPLOY-RESEARCH-STALL-1A — Read-only production upstream audit (temporary probe).
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { loadGrowthHomeRuntimeTrustPayload } from "@/lib/growth/home/growth-home-runtime-trust-loader-1b"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { analyzeGrowthLeadAdmissionProductionPool } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"

const OBSERVABILITY_DEPLOY_AT = "2026-07-22T17:37:36.000Z"
const BAKER_HUGHES_LEAD = "86a3c979-ef32-43fa-af39-7ed1ac7305c9"
const SLUSS_LEAD = "3caafb29-1f9d-4569-99dd-44f4cecf9049"

async function countRows(
  admin: Awaited<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>> extends infer T
    ? T extends { admin: infer A }
      ? A
      : never
    : never,
  table: string,
  filter: (q: ReturnType<ReturnType<typeof admin.schema>["from"]>) => ReturnType<ReturnType<typeof admin.schema>["from"]>,
): Promise<number> {
  const { count, error } = await filter(admin.schema("growth").from(table).select("id", { count: "exact", head: true }))
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("Run via vercel-production-env-run.ts")
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  console.log(JSON.stringify({ phase: "GE-AIOS-POST-DEPLOY-RESEARCH-STALL-1A", orgId, observabilityDeployAt: OBSERVABILITY_DEPLOY_AT }, null, 2))

  const killSwitches = await getRuntimeKillSwitchStates(admin).catch(() => null)

  const [{ data: audiences }, { data: dmRuns }, { data: researchRuns }, { data: events }, { data: leadsSinceDeploy }] =
    await Promise.all([
      admin.schema("growth").from("growth_audiences").select("id, name, status, created_at, updated_at").eq("organization_id", orgId),
      admin
        .schema("growth")
        .from("datamoon_audience_import_runs")
        .select(
          "id, run_name, status, datamoon_audience_id, requested_limit, record_count, preview_count, imported_count, duplicate_count, last_polled_at, completed_at, error_message, provider_metadata, created_at",
        )
        .like("run_name", "ge-aios-autonomous-prospect-search:%")
        .gte("created_at", OBSERVABILITY_DEPLOY_AT)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .schema("growth")
        .from("research_runs")
        .select("id, lead_id, status, company_name, created_at, started_at, completed_at, failed_reason")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(30),
      admin
        .schema("growth")
        .from("ai_os_events")
        .select("id, event_type, entity_id, occurred_at, payload")
        .eq("organization_id", orgId)
        .eq("event_type", "growth.workflow.status_changed")
        .gte("occurred_at", OBSERVABILITY_DEPLOY_AT)
        .order("occurred_at", { ascending: false })
        .limit(50),
      admin
        .schema("growth")
        .from("leads")
        .select("id, company_name, status, created_at, metadata, latest_prospect_research_run_id, last_prospect_researched_at")
        .eq("organization_id", orgId)
        .gte("created_at", OBSERVABILITY_DEPLOY_AT)
        .order("created_at", { ascending: false })
        .limit(50),
    ])

  const researchCompleteEvents = (events ?? []).filter(
    (row) => typeof row.payload === "object" && row.payload && (row.payload as { workflow_status?: string }).workflow_status === "research_complete",
  )

  const dmRunsAll = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, run_name, status, record_count, imported_count, duplicate_count, last_polled_at, completed_at, error_message, created_at")
    .like("run_name", "ge-aios-autonomous-prospect-search:%")
    .order("created_at", { ascending: false })
    .limit(10)

  const lastSuccessfulDm = [...(dmRunsAll.data ?? [])].find((row) => row.status === "completed" || (row.imported_count ?? 0) > 0)

  const schedulerRuns = await listRecentGrowthCronExecutionRuns(admin, {
    cronRoute: growthCronApiPath("growth-objective-runtime-scheduler"),
    limit: 15,
  })

  const postDeployScheduler = schedulerRuns.filter((row) => Date.parse(row.startedAt) >= Date.parse(OBSERVABILITY_DEPLOY_AT))

  const admissionPool = await analyzeGrowthLeadAdmissionProductionPool(admin, { organizationId: orgId }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }))

  const researchQueued = await countRows(admin, "research_runs", (q) =>
    q.eq("organization_id", orgId).eq("status", "queued"),
  )
  const researchRunning = await countRows(admin, "research_runs", (q) =>
    q.eq("organization_id", orgId).eq("status", "running"),
  )
  const researchCompletedSinceDeploy = await countRows(admin, "research_runs", (q) =>
    q.eq("organization_id", orgId).eq("status", "completed").gte("completed_at", OBSERVABILITY_DEPLOY_AT),
  )
  const researchStartedSinceDeploy = await countRows(admin, "research_runs", (q) =>
    q.eq("organization_id", orgId).gte("created_at", OBSERVABILITY_DEPLOY_AT),
  )

  const [{ data: bakerLead }, { data: slussLead }] = await Promise.all([
    admin.schema("growth").from("leads").select("*").eq("id", BAKER_HUGHES_LEAD).maybeSingle(),
    admin.schema("growth").from("leads").select("*").eq("id", SLUSS_LEAD).maybeSingle(),
  ])

  const trustPayload = await loadGrowthHomeRuntimeTrustPayload(admin, { organizationId: orgId }).catch(() => null)
  const trust = trustPayload
    ? buildGrowthHomeRuntimeTrustViewModel({
        payload: trustPayload,
        nowMs: Date.now(),
        organizationId: orgId,
      })
    : null

  const homeSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: process.env.GROWTH_OPERATOR_EMAIL ?? "operations@equipify.ai",
    actorUserId: process.env.GROWTH_OPERATOR_ACTOR_USER_ID ?? "00000000-0000-0000-0000-000000000001",
  }).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }))

  const leadsPostDeployAdmission = (leadsSinceDeploy ?? []).map((lead) => ({
    id: lead.id,
    company: lead.company_name,
    status: lead.status,
    createdAt: lead.created_at,
    admission: resolveLeadAdmissionStateFromMetadata(lead.metadata),
    researchedAt: lead.last_prospect_researched_at,
  }))

  console.log(
    JSON.stringify(
      {
        killSwitches,
        discovery: {
          activeAudiences: (audiences ?? []).filter((a) => a.status === "active").length,
          audiences: audiences ?? [],
          datamoonRunsSinceObservabilityDeploy: dmRuns ?? [],
          lastSuccessfulDatamoonRun: lastSuccessfulDm ?? null,
          recentDatamoonRuns: dmRunsAll.data ?? [],
        },
        admission: {
          leadsCreatedSinceObservabilityDeploy: leadsPostDeployAdmission,
          admissionPoolSummary: admissionPool,
        },
        research: {
          queued: researchQueued,
          running: researchRunning,
          startedSinceObservabilityDeploy: researchStartedSinceDeploy,
          completedSinceObservabilityDeploy: researchCompletedSinceDeploy,
          recentRuns: researchRuns ?? [],
        },
        events: {
          workflowEventsSinceObservabilityDeploy: (events ?? []).length,
          researchCompleteSinceObservabilityDeploy: researchCompleteEvents,
        },
        scheduler: {
          recentRuns: schedulerRuns.slice(0, 5),
          runsSinceObservabilityDeploy: postDeployScheduler.length,
          postDeploySchedulerSample: postDeployScheduler.slice(0, 5),
        },
        canonicalTimestamps: {
          lastDiscoveryRun: dmRunsAll.data?.[0]?.created_at ?? null,
          lastResearchCompleted: researchRuns?.find((r) => r.status === "completed")?.completed_at ?? null,
          lastResearchStarted: researchRuns?.find((r) => r.started_at)?.started_at ?? null,
          lastWakeAttempt: null,
        },
        home: {
          canonicalOperatorFocus:
            homeSummary && "canonicalOperatorFocus" in homeSummary ? homeSummary.canonicalOperatorFocus : null,
          heroLeadId: homeSummary && "heroLeadId" in homeSummary ? homeSummary.heroLeadId : null,
          runtimeTrust: trust
            ? {
                lastAutonomousActionAt: trust.lastAutonomousActionAt,
                lastAutonomousActionLabel: trust.lastAutonomousActionLabel,
                lastAutonomousActivitySource: trust.lastAutonomousActivitySource,
                schedulerStatus: trust.schedulerStatus,
              }
            : null,
          homeError: homeSummary && "error" in homeSummary ? homeSummary.error : null,
        },
        leadComparison: {
          bakerHughes: bakerLead
            ? {
                id: bakerLead.id,
                company: bakerLead.company_name,
                status: bakerLead.status,
                lastResearched: bakerLead.last_prospect_researched_at,
                admission: resolveLeadAdmissionStateFromMetadata(bakerLead.metadata),
              }
            : null,
          slussPadgett: slussLead
            ? {
                id: slussLead.id,
                company: slussLead.company_name,
                status: slussLead.status,
                lastResearched: slussLead.last_prospect_researched_at,
                admission: resolveLeadAdmissionStateFromMetadata(slussLead.metadata),
              }
            : null,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
