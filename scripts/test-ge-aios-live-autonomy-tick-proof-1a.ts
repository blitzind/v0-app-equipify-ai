/**
 * GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1A — Production scheduler tick + ASL branch proof (read-only).
 *
 * Run: pnpm test:ge-aios-live-autonomy-tick-proof-1a
 * Requires Vercel Production env via vercel-production-env-run.ts wrapper.
 *
 * GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1B corrects misleading local-secret and legacy Home-path conclusions.
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthAiosAutonomyTickHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a"
import { resolveGrowthAiosAutonomyTickProofVerdict } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchDeployedGrowthAiosAutonomyTickHealth } from "@/lib/growth/qa/growth-aios-autonomy-tick-health-deployed-probe"
import { fetchDeployedGrowthAiosRuntimeConfigHealth } from "@/lib/growth/qa/growth-aios-runtime-config-health-deployed-probe"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { listActiveRunningGrowthObjectiveOrganizationIds } from "@/lib/growth/objectives/growth-objective-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { classifyBooleanFromDeployedOrLocal } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-classifiers"
import type { GrowthAiosRuntimeConfigHealthSnapshot } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-types"
import type { GrowthAiosAutonomyTickProofVerdict } from "@/lib/growth/aios/runtime/growth-aios-autonomy-tick-health-1a-types"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_QA_MARKER =
  "ge-aios-live-autonomy-tick-proof-1a-v1" as const

const CODE_BATCH_MARKERS = [
  "lib/growth/aios/runtime/growth-aios-runtime-context-1a.ts",
  "lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot.ts",
  "lib/growth/objectives/growth-objective-scheduler-selection-1a.ts",
  "lib/growth/aios/execution/growth-canonical-execution-authority-1a.ts",
  "lib/growth/aios/execution/growth-degraded-enforcement-policy-1a.ts",
  "scripts/test-ge-aios-autonomy-recertification-1a.ts",
] as const

type BranchRow = {
  stage: string
  input: string
  output: string
  status: string
  reason: string
}

function gitDeployedSha(): string {
  try {
    return execSync("gh api repos/blitzind/v0-app-equipify-ai/deployments --jq '.[0].sha'", {
      encoding: "utf8",
    }).trim()
  } catch {
    return process.env.GE_AIOS_DEPLOYED_SHA?.trim() ?? "unknown"
  }
}

function codeBatchPresent(deployedSha: string): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const file of CODE_BATCH_MARKERS) {
    try {
      execSync(`git cat-file -e ${deployedSha}:${file}`, { stdio: "ignore" })
      result[file] = true
    } catch {
      result[file] = false
    }
  }
  return result
}

async function resolveDeployedBearer(boot: { url: string; jwt: string }): Promise<string | null> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) return null
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
  })
  return minted.access_token
}

/** Deployed ASL path: portfolio snapshot → Work Manager → selected work. */
export async function tracePortfolioAslPath(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  branchTrace: BranchRow[]
  leadCount: number
  candidateCount: number
  executableCount: number
  selectedWorkId: string | null
  selectedWorkType: string | null
  stopReason: string
}> {
  const branchTrace: BranchRow[] = []
  const generatedAt = new Date().toISOString()

  const snapshot = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
    organizationId,
    generatedAt,
  }).catch(() => null)

  branchTrace.push({
    stage: "buildGrowthAutonomousPortfolioWorkSnapshot",
    input: organizationId.slice(0, 8),
    output: snapshot ? "ok" : "null",
    status: snapshot ? "executing" : "blocked",
    reason: snapshot ? "portfolio_snapshot_built" : "portfolio_snapshot_unavailable",
  })
  if (!snapshot) {
    return {
      branchTrace,
      leadCount: 0,
      candidateCount: 0,
      executableCount: 0,
      selectedWorkId: null,
      selectedWorkType: null,
      stopReason: "portfolio_snapshot_unavailable",
    }
  }

  const { summary: memorySummary } = runMemoryEngine({
    organizationId,
    generatedAt,
    workspaceSummary: snapshot.workManagerInput.workspaceSummary,
    waitingOnYou: snapshot.workManagerInput.waitingOnYou,
    dailyWorkQueue: snapshot.workManagerInput.dailyWorkQueue,
    accomplishments: snapshot.workManagerInput.accomplishments,
    timeline: snapshot.workManagerInput.timeline,
    persistedStore: snapshot.organizationalMemory.store,
    salesOutcomes: snapshot.salesOutcomes.outcomes,
    organizationalKnowledge: snapshot.organizationalKnowledge.store.items,
  })

  branchTrace.push({
    stage: "runMemoryEngine",
    input: String(snapshot.leadCount),
    output: "ok",
    status: "executing",
    reason: "runtime_context_memory_resolved",
  })

  const workResult = runWorkManager({
    ...snapshot.workManagerInput,
    memorySummary,
  })

  const candidateCount = workResult.all_work_items.length
  const executable = workResult.all_work_items.filter(isExecutableWorkItem)
  branchTrace.push({
    stage: "runWorkManager",
    input: String(candidateCount),
    output: String(executable.length),
    status: executable.length > 0 ? "executing" : "empty",
    reason: "decision_engine_work_manager_ranking",
  })

  const selected = selectNextExecutableWorkItem(workResult)
  branchTrace.push({
    stage: "selectNextExecutableWorkItem",
    input: String(executable.length),
    output: selected?.id ?? "null",
    status: selected ? "selected" : "blocked",
    reason: selected ? selected.type : "no_executable_work",
  })

  return {
    branchTrace,
    leadCount: snapshot.leadCount,
    candidateCount,
    executableCount: executable.length,
    selectedWorkId: selected?.id ?? null,
    selectedWorkType: selected?.type ?? null,
    stopReason: selected ? "would_execute" : "no_executable_work",
  }
}

/** Historical comparison only — not the deployed ASL path after portfolio snapshot batch. */
export async function traceLegacyHomeSummaryComparison(
  admin: SupabaseClient,
): Promise<{ dailyWorkQueueCount: number; selectedWorkId: string | null }> {
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "ava-autonomous@equipify.ai",
    actorUserId: "autonomous-sales-loop",
  }).catch(() => null)
  if (!summary?.ok) {
    return { dailyWorkQueueCount: 0, selectedWorkId: null }
  }
  const briefing = synthesizeGrowthHomeExecutiveBriefing({ dashboard: summary.dashboard })
  const wmInput = {
    workspaceSummary: {
      kpis: summary.kpis,
      meetings: summary.meetings,
      inbox: summary.inbox,
      operatorTasks: summary.operatorTasks,
      avaConsole: summary.avaConsole,
      dashboard: summary.dashboard,
      leadPool: summary.leadPool,
      missionDiscovery: summary.missionDiscovery ?? null,
    },
    waitingOnYou: briefing.aiOsUx.waitingOnYou,
    dailyWorkQueue: briefing.aiOsUx.dailyWorkQueue,
    accomplishments: briefing.accomplishments,
    timeline: briefing.timeline,
    generatedAt: new Date().toISOString(),
    leadSnapshotsById: summary.relationshipSnapshots.byLeadId,
  }
  const workResult = runWorkManager({ ...wmInput, memorySummary: null })
  const selected = selectNextExecutableWorkItem(workResult)
  return {
    dailyWorkQueueCount: briefing.aiOsUx.dailyWorkQueue.length,
    selectedWorkId: selected?.id ?? null,
  }
}

async function main(): Promise<void> {
  console.log("GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1A\n")
  assert.equal(process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN, "1")

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("Bootstrap failed")
    process.exit(1)
  }
  const admin = boot.admin
  const vercelProductionEnvRun = true

  const deployedSha = gitDeployedSha()
  const batchPresent = codeBatchPresent(deployedSha)
  const batchAllPresent = Object.values(batchPresent).every(Boolean)

  const bearer = await resolveDeployedBearer(boot)
  const deployedConfigProbe = bearer
    ? await fetchDeployedGrowthAiosRuntimeConfigHealth({ bearerToken: bearer })
    : null
  const deployedConfig: GrowthAiosRuntimeConfigHealthSnapshot | null =
    deployedConfigProbe?.ok ? deployedConfigProbe.snapshot : null

  const nativeDecisionClassification = classifyBooleanFromDeployedOrLocal({
    deployedValue: deployedConfig?.nativeDecisionEngineEnabled,
    localValue: false,
    localEnvPresent: Boolean(process.env.GROWTH_NATIVE_DECISION_ENGINE?.trim()),
    vercelProductionEnvRun,
  })
  const drqClassification = classifyBooleanFromDeployedOrLocal({
    deployedValue: deployedConfig?.dailyRevenueWorkQueueEnabled,
    localValue: false,
    localEnvPresent:
      Boolean(process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE?.trim()) ||
      Boolean(process.env.GROWTH_NATIVE_DECISION_ENGINE?.trim()),
    vercelProductionEnvRun,
  })

  console.log("=== Phase 1 — Deployed runtime identity + config health ===")
  console.log(
    JSON.stringify(
      {
        deployment_sha: deployedSha,
        code_batch_all_present: batchAllPresent,
        deployed_runtime_config_probe: deployedConfigProbe
          ? { probed: deployedConfigProbe.probed, ok: deployedConfigProbe.ok, status: deployedConfigProbe.status }
          : { probed: false },
        deployed_runtime_config: deployedConfig
          ? {
              organizationConfigured: deployedConfig.organizationConfigured,
              nativeDecisionEngineEnabled: deployedConfig.nativeDecisionEngineEnabled,
              dailyRevenueWorkQueueEnabled: deployedConfig.dailyRevenueWorkQueueEnabled,
              schedulerMigrationReady: deployedConfig.schedulerMigrationReady,
              outboundEnabled: deployedConfig.outboundEnabled,
            }
          : null,
        configuration_classifications: {
          native_decision_engine: nativeDecisionClassification,
          daily_revenue_work_queue: drqClassification,
        },
        local_env_org_present: Boolean(process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()),
        local_env_org_resolved: getGrowthEngineAiOrgId() != null,
      },
      null,
      2,
    ),
  )

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const orgIds = await listActiveRunningGrowthObjectiveOrganizationIds(admin)
  const aslOrgId =
    orgIds.find((id) => id === EQUIPIFY_PRODUCTION_ORG_ID) ?? orgIds[0] ?? EQUIPIFY_PRODUCTION_ORG_ID

  console.log("\n=== Phase 2 — Scheduler DB evidence ===")
  console.log(
    JSON.stringify(
      {
        organization_candidates: orgIds.length,
        objectives_running_orgs: orgIds.slice(0, 5).map((id) => id.slice(0, 8)),
        kill_switches: {
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        deployed_active_objectives: deployedConfig?.activeObjectiveCount ?? null,
        deployed_due_running_objectives: deployedConfig?.dueRunningObjectiveCount ?? null,
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 3 — Deployed ASL path (portfolio snapshot trace) ===")
  const portfolioTrace = await tracePortfolioAslPath(admin, aslOrgId)
  console.table(portfolioTrace.branchTrace)
  console.log(JSON.stringify({ stop_reason: portfolioTrace.stopReason, ...portfolioTrace }, null, 2))

  console.log("\n=== Phase 4 — Deployed autonomy tick dry-run diagnostic ===")
  const deployedTickProbe = bearer
    ? await fetchDeployedGrowthAiosAutonomyTickHealth({ bearerToken: bearer })
    : null
  const localTickHealth = await buildGrowthAiosAutonomyTickHealthSnapshot(admin)
  console.log(
    JSON.stringify(
      {
        deployed_probe: deployedTickProbe
          ? {
              probed: deployedTickProbe.probed,
              ok: deployedTickProbe.ok,
              status: deployedTickProbe.status,
              error: deployedTickProbe.ok ? null : deployedTickProbe.error,
            }
          : { probed: false, error: "bearer_unavailable" },
        deployed_tick_health: deployedTickProbe?.ok ? deployedTickProbe.snapshot : null,
        local_deterministic_replay: localTickHealth,
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 5 — Local ASL dry-run replay (current workspace code) ===")
  const dryLoop = await inspectAutonomousSalesLoopDryRun(admin, { organizationId: aslOrgId })
  console.log(
    JSON.stringify(
      {
        stop_reason: dryLoop.stop_reason,
        selected_work_count: dryLoop.selected_work?.length ?? 0,
        selected_work_types: dryLoop.selected_work?.map((row) => row.workflow_agent) ?? [],
        dry_run: dryLoop.dry_run,
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 6 — Legacy Home summary comparison (historical only) ===")
  const legacy = await traceLegacyHomeSummaryComparison(admin)
  console.log(
    JSON.stringify(
      {
        label: "historical_comparison_not_deployed_asl_path",
        daily_work_queue_count: legacy.dailyWorkQueueCount,
        selected_work_id_prefix: legacy.selectedWorkId?.slice(0, 12) ?? null,
      },
      null,
      2,
    ),
  )

  const tickHealth = deployedTickProbe?.ok
    ? deployedTickProbe.snapshot
    : {
        ...localTickHealth,
        organizationResolved:
          deployedConfig?.organizationConfigured ??
          localTickHealth.organizationResolved ??
          portfolioTrace.branchTrace[0]?.status === "executing",
        portfolioSnapshotBuilt: portfolioTrace.branchTrace[0]?.status === "executing",
        leadCount: portfolioTrace.leadCount,
        candidateCount: portfolioTrace.candidateCount,
        selectedWork: Boolean(portfolioTrace.selectedWorkId),
        selectedWorkType: portfolioTrace.selectedWorkType,
        workflowAgent: dryLoop.selected_work?.[0]?.workflow_agent ?? null,
        wouldExecute:
          Boolean(portfolioTrace.selectedWorkId) &&
          (dryLoop.selected_work?.length ?? 0) > 0 &&
          (localTickHealth.authorityDisposition === "allowed" ||
            localTickHealth.authorityDisposition == null),
        outboundEnabled: deployedConfig?.outboundEnabled ?? localTickHealth.outboundEnabled,
        authorityDisposition: localTickHealth.authorityDisposition,
        decisionResolved: localTickHealth.decisionResolved,
        admissionBlocked: localTickHealth.admissionBlocked,
      }

  let verdict: GrowthAiosAutonomyTickProofVerdict = resolveGrowthAiosAutonomyTickProofVerdict({
    tickHealth,
    runtimeCodeDefect: !batchAllPresent,
    activeLeadCount: tickHealth.leadCount,
  })

  if (!batchAllPresent) {
    verdict = "BLOCKED_BY_RUNTIME_CODE_DEFECT"
  }

  console.log("\n=== PRIMARY ANSWER ===")
  console.log(
    `Deployed configuration: nativeDecision=${deployedConfig?.nativeDecisionEngineEnabled ?? "unverified"}, DRQ=${deployedConfig?.dailyRevenueWorkQueueEnabled ?? "unverified"}\n` +
      `Deployed ASL path: portfolio snapshot → Work Manager → ${portfolioTrace.selectedWorkType ?? "none"}\n` +
      `Authority disposition: ${tickHealth.authorityDisposition ?? "unknown"}\n` +
      `Would execute (dry-run): ${tickHealth.wouldExecute}\n` +
      `Legacy Home path (historical): dailyWorkQueue=${legacy.dailyWorkQueueCount}`,
  )

  console.log(`\nQA marker: ${GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_QA_MARKER}`)
  console.log(`VERDICT: ${verdict}`)

  if (verdict !== "READY_FOR_FIRST_INTERNAL_AUTONOMY_TICK") {
    process.exit(verdict === "BLOCKED_BY_RUNTIME_CODE_DEFECT" ? 2 : 1)
  }
}

void main()
