/**
 * GE-AIOS-FIRST-LIVE-SCHEDULER-TICK-1A — One controlled Production scheduler cycle (operational proof).
 */
import { execSync } from "node:child_process"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { buildPortfolioEligibilityContext } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { fetchDeployedGrowthAiosRuntimeConfigHealth } from "@/lib/growth/qa/growth-aios-runtime-config-health-deployed-probe"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"

export const GE_AIOS_FIRST_LIVE_SCHEDULER_TICK_1A_QA_MARKER =
  "ge-aios-first-live-scheduler-tick-1a-v1" as const

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

const DEPLOYMENT_FILES = [
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a.ts",
  "lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a.ts",
  "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  "components/growth/workspace/executive-briefing/growth-home-portfolio-manager-section.tsx",
  "lib/growth/memory/institutional-learning/growth-institutional-learning-truthfulness-1a.ts",
  "lib/growth/objectives/growth-objective-runtime-scheduler.ts",
] as const

function deployedSha(): string {
  try {
    return execSync("gh api repos/blitzind/v0-app-equipify-ai/deployments --jq '.[0].sha'", {
      encoding: "utf8",
    }).trim()
  } catch {
    return process.env.GE_AIOS_DEPLOYED_SHA?.trim() ?? "unknown"
  }
}

function shaContainsFile(sha: string, file: string): boolean {
  try {
    execSync(`git cat-file -e ${sha}:${file}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

async function portfolioSnapshot(admin: import("@supabase/supabase-js").SupabaseClient, orgId: string) {
  const generatedAt = new Date().toISOString()
  const work = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: orgId, generatedAt })
  const approved = await getActiveApprovedBusinessProfile(admin, orgId).catch(() => null)
  const pm =
    work?.portfolioManager ??
    buildGrowthPortfolioManagerSnapshot({
      organizationId: orgId,
      generatedAt,
      leads: work?.portfolioLeads ?? [],
      eligibleLeadCount: work?.eligibleLeadCount ?? 0,
      approvedProfile: approved?.profile ?? null,
    })
  return { generatedAt, work, pm, approved }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }

  const startedAt = Date.now()
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const sha = deployedSha()
  const deploymentProof = Object.fromEntries(DEPLOYMENT_FILES.map((file) => [file, shaContainsFile(sha, file)]))
  const allDeployed = Object.values(deploymentProof).every(Boolean)

  console.log(
    JSON.stringify(
      { phase: "deployment_proof", qaMarker: GE_AIOS_FIRST_LIVE_SCHEDULER_TICK_1A_QA_MARKER, deployedSha: sha, allDeployed, files: deploymentProof },
      null,
      2,
    ),
  )
  if (!allDeployed) {
    console.log("\nVERDICT: BLOCKED_BY_UNDEPLOYED_PORTFOLIO_MANAGER\n")
    process.exit(2)
  }

  const bearer = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  })
    .then((r) => r.access_token)
    .catch(() => null)

  const deployedConfig = bearer
    ? await fetchDeployedGrowthAiosRuntimeConfigHealth({ bearerToken: bearer })
    : null

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const pre = await portfolioSnapshot(admin, orgId)

  const [dfStates, approvalRuns, objectives, blockImagingDf, blockImagingPkg, blockImagingLead] =
    await Promise.all([
      admin.schema("growth").from("draft_factory_lead_states").select("lead_id, state, paused_reason, package_id").limit(50),
      admin
        .schema("growth")
        .from("autonomous_outreach_preparation_runs")
        .select("id, lead_id, status, created_at, package_id")
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .schema("growth")
        .from("organization_growth_objectives")
        .select("id, status, scheduler_runtime_running", { count: "exact" })
        .eq("status", "active")
        .limit(10),
      admin.schema("growth").from("draft_factory_lead_states").select("*").eq("lead_id", BLOCK_IMAGING_LEAD_ID).maybeSingle(),
      admin.schema("growth").from("autonomous_outreach_preparation_runs").select("*").eq("lead_id", BLOCK_IMAGING_LEAD_ID).limit(5),
      admin.schema("growth").from("leads").select("id, company_name, status, metadata, archived_at").eq("id", BLOCK_IMAGING_LEAD_ID).maybeSingle(),
    ])

  const leadPool = await fetchGrowthHomeLeadPoolPage(admin, { limit: 100 })
  const eligibility = buildPortfolioEligibilityContext(orgId, leadPool.leads)

  console.log(
    JSON.stringify(
      {
        phase: "pre_tick_snapshot",
        organizationId: orgId,
        deployedRuntimeConfig: deployedConfig?.ok ? deployedConfig.snapshot : { probed: deployedConfig?.probed ?? false },
        killSwitches: {
          autonomy_enabled: killSwitches.autonomy_enabled,
          autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        portfolio: {
          target: pre.pm.target.targetActiveCompanies,
          healthyMinimum: pre.pm.target.minimumHealthyCompanies,
          eligibleActive: pre.pm.health.counts.activeCompanies,
          healthState: pre.pm.health.healthState,
          replenishmentShouldRun: pre.pm.replenishment.shouldReplenish,
          replenishmentReason: pre.pm.replenishment.reason,
          replenishmentBatchSize: pre.pm.replenishment.batchSize,
        },
        eligibleLeadCount: eligibility.eligibleCount,
        draftFactoryStatesSample: dfStates.data?.length ?? 0,
        approvalPackagesSample: approvalRuns.data?.length ?? 0,
        activeObjectives: objectives.count,
      },
      null,
      2,
    ),
  )

  const tickStartedIso = new Date().toISOString()
  const tickStartedAt = Date.now()
  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)
  const tickDurationMs = Date.now() - tickStartedAt

  const recentLeads = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, status, metadata, created_at")
    .gte("created_at", tickStartedIso)
    .order("created_at", { ascending: false })
    .limit(30)

  const post = await portfolioSnapshot(admin, orgId)
  const aslDryRun = await inspectAutonomousSalesLoopDryRun(admin, { organizationId: orgId })
  const equipifyAsl =
    schedulerResult.autonomousSalesLoop?.organization_results.find((row) => row.organizationId === orgId) ?? null

  const homeSummary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "ava-autonomous@equipify.ai",
    actorUserId: "first-live-scheduler-tick-1a",
  }).catch(() => null)
  const briefing = homeSummary?.ok
    ? synthesizeGrowthHomeExecutiveBriefing({ dashboard: homeSummary.dashboard })
    : null

  const stages = [
    {
      stage: "portfolio_manager",
      entered: true,
      completed: (schedulerResult.telemetry?.portfolioReplenishmentsAttempted ?? 0) > 0,
      skipped: !pre.pm.replenishment.shouldReplenish,
      stopReason: pre.pm.replenishment.reason,
      durationMs: tickDurationMs,
    },
    {
      stage: "prospect_search",
      entered: pre.pm.replenishment.shouldReplenish,
      completed: (recentLeads.data?.length ?? 0) > 0,
      skipped: !pre.pm.replenishment.shouldReplenish,
      stopReason:
        pre.pm.replenishment.shouldReplenish && (recentLeads.data?.length ?? 0) === 0
          ? "no_new_leads_observed_after_tick"
          : null,
      rowsCreated: recentLeads.data?.length ?? 0,
    },
    {
      stage: "unified_intake_admission",
      entered: (recentLeads.data?.length ?? 0) > 0,
      completed: false,
      skipped: (recentLeads.data?.length ?? 0) === 0,
      stopReason: (recentLeads.data?.length ?? 0) === 0 ? "no_new_intake_in_tick_window" : "pending_post_tick_analysis",
    },
    {
      stage: "autonomous_sales_loop",
      entered: Boolean(schedulerResult.autonomousSalesLoop),
      completed: equipifyAsl?.executed === true,
      skipped: equipifyAsl?.executed === false,
      stopReason: equipifyAsl?.stop_reason ?? schedulerResult.autonomousSalesLoop?.skipped_reason ?? null,
    },
    {
      stage: "work_manager",
      entered: true,
      completed: (aslDryRun.selected_work?.length ?? 0) > 0,
      skipped: aslDryRun.stop_reason === "no_executable_work",
      stopReason: aslDryRun.stop_reason,
    },
    {
      stage: "draft_factory",
      entered: Boolean(schedulerResult.draftFactoryDue),
      completed: (schedulerResult.telemetry?.draftFactoryAdvances ?? 0) > 0,
      skipped: !schedulerResult.draftFactoryDue,
      stopReason: schedulerResult.draftFactoryDue?.skipped_reason ?? null,
      rowsChanged: {
        dueAdvanced: schedulerResult.draftFactoryDue?.due_advanced ?? 0,
        packagesGenerated: schedulerResult.telemetry?.packagesGenerated ?? 0,
      },
    },
    {
      stage: "approval_package",
      entered: (schedulerResult.telemetry?.packagesGenerated ?? 0) > 0,
      completed: (schedulerResult.telemetry?.packagesGenerated ?? 0) > 0,
      skipped: (schedulerResult.telemetry?.packagesGenerated ?? 0) === 0,
      stopReason:
        (schedulerResult.telemetry?.packagesGenerated ?? 0) === 0
          ? "no_packages_generated_in_tick"
          : null,
    },
  ]

  console.log(
    JSON.stringify(
      {
        phase: "controlled_tick",
        durationMs: tickDurationMs,
        schedulerQaMarker: schedulerResult.qa_marker,
        telemetry: schedulerResult.telemetry,
        equipifyAsl,
        recentLeads: recentLeads.data ?? [],
        stages,
      },
      null,
      2,
    ),
  )

  console.log(
    JSON.stringify(
      {
        phase: "post_tick_snapshot",
        eligibleActiveBefore: pre.pm.health.counts.activeCompanies,
        eligibleActiveAfter: post.pm.health.counts.activeCompanies,
        delta: post.pm.health.counts.activeCompanies - pre.pm.health.counts.activeCompanies,
        replenishmentProof: {
          wasBelowHealthy: pre.pm.health.healthState !== "healthy",
          batchRequested: pre.pm.replenishment.shouldReplenish,
          batchSize: pre.pm.replenishment.batchSize,
          portfolioReplenishmentsAttempted: schedulerResult.telemetry?.portfolioReplenishmentsAttempted ?? 0,
          portfolioReplenishmentsCompleted: schedulerResult.telemetry?.portfolioReplenishmentsCompleted ?? 0,
          newLeadsInWindow: recentLeads.data?.length ?? 0,
        },
      },
      null,
      2,
    ),
  )

  const blockImagingAnalysis = {
    lead: blockImagingLead.data,
    draftFactory: blockImagingDf.data,
    preparationRuns: blockImagingPkg.data,
    mismatchReason:
      blockImagingDf.data?.state === "waiting_for_approval" && !(blockImagingPkg.data?.length ?? 0)
        ? blockImagingDf.data?.package_id
          ? "draft_factory_state_waiting_for_approval_with_package_id_but_no_autonomous_outreach_preparation_runs_row"
          : "draft_factory_advanced_to_waiting_for_approval_without_growth_5f_package_persistence_boundary"
        : null,
  }

  console.log(JSON.stringify({ phase: "block_imaging", ...blockImagingAnalysis }, null, 2))

  console.log(
    JSON.stringify(
      {
        phase: "home_truthfulness",
        portfolioHealthLabel: post.pm.operator.healthLabel,
        discoveryStatus: post.pm.operator.discoveryRunning ? "running" : "idle",
        researchStatus: post.pm.operator.researchRunning ? "running" : "idle",
        institutionalLearningBullets: briefing?.aiOsUx?.memorySummary?.learnedInsights ?? [],
        archivedInEligiblePool: leadPool.leads.some((lead) => lead.status === "archived" || lead.archivedAt),
      },
      null,
      2,
    ),
  )

  const verdict = resolveVerdict({
    pre,
    post,
    aslDryRun,
    schedulerResult,
    blockImagingAnalysis,
    recentLeadCount: recentLeads.data?.length ?? 0,
  })

  console.log(`\nVERDICT: ${verdict}\n`)
  console.log(JSON.stringify({ totalDurationMs: Date.now() - startedAt }, null, 2))
  process.exit(verdict === "FIRST_LIVE_PORTFOLIO_TICK_COMPLETED" ? 0 : 1)
}

function resolveVerdict(input: {
  pre: Awaited<ReturnType<typeof portfolioSnapshot>>
  post: Awaited<ReturnType<typeof portfolioSnapshot>>
  aslDryRun: Awaited<ReturnType<typeof inspectAutonomousSalesLoopDryRun>>
  schedulerResult: Awaited<ReturnType<typeof runGrowthObjectiveRuntimeScheduler>>
  blockImagingAnalysis: { mismatchReason: string | null }
  recentLeadCount: number
}): string {
  if (input.schedulerResult.skippedReason?.includes("disabled")) {
    return "BLOCKED_AT_WORK_MANAGER"
  }

  const replenishmentAttempted = (input.schedulerResult.telemetry?.portfolioReplenishmentsAttempted ?? 0) > 0
  const portfolioWasCriticallyLow = input.pre.pm.health.healthState === "critically_low"

  if (portfolioWasCriticallyLow && input.recentLeadCount === 0 && replenishmentAttempted) {
    return "BLOCKED_AT_PROSPECT_SEARCH"
  }

  if (input.aslDryRun.stop_reason === "no_executable_work" && input.recentLeadCount === 0) {
    if (
      input.blockImagingAnalysis.mismatchReason &&
      (input.schedulerResult.telemetry?.packagesGenerated ?? 0) === 0
    ) {
      return "BLOCKED_AT_APPROVAL_PERSISTENCE"
    }
    return "BLOCKED_AT_WORK_MANAGER"
  }

  if (replenishmentAttempted || input.recentLeadCount > 0 || input.post.pm.health.counts.activeCompanies > input.pre.pm.health.counts.activeCompanies) {
    return "FIRST_LIVE_PORTFOLIO_TICK_COMPLETED"
  }

  return "BLOCKED_AT_WORK_MANAGER"
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
