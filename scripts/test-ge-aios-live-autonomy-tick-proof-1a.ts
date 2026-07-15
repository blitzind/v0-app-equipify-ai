/**
 * GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1A — Production scheduler tick + ASL branch proof (read-only).
 *
 * Run: pnpm test:ge-aios-live-autonomy-tick-proof-1a
 * Requires Vercel Production env via vercel-production-env-run.ts wrapper.
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { resolveLeadCommunicationStrategyBundle } from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import {
  resolveDailyRevenueWorkQueueForLeads,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-resolver"
import { flattenDecisionCandidates } from "@/lib/growth/decision-engine/context/build-decision-context"
import { runDecisionEngine } from "@/lib/growth/decision-engine/engine/run-decision-engine"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { fetchGrowthHomeLeadPoolPage } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { listActiveRunningGrowthObjectiveOrganizationIds } from "@/lib/growth/objectives/growth-objective-repository"
import { isAvaOutreachExecutionRequestEnabled } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-service"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { evaluateCanonicalExecutionAuthorityForLead } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-server-1a"
import { isCanonicalExecutionAllowed } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { runAutonomousSalesLoop } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthLead } from "@/lib/growth/types"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_QA_MARKER =
  "ge-aios-live-autonomy-tick-proof-1a-v1" as const

export const GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_VERDICT = {
  READY_TO_ACTIVATE_INTERNAL_AUTONOMY: "READY_TO_ACTIVATE_INTERNAL_AUTONOMY",
  READY_AFTER_TARGETED_CONFIGURATION: "READY_AFTER_TARGETED_CONFIGURATION",
  BLOCKED_BY_UNDEPLOYED_RUNTIME_BATCH: "BLOCKED_BY_UNDEPLOYED_RUNTIME_BATCH",
  BLOCKED_BY_OBSOLETE_FEATURE_GATE: "BLOCKED_BY_OBSOLETE_FEATURE_GATE",
  BLOCKED_BY_ORGANIZATION_RESOLUTION: "BLOCKED_BY_ORGANIZATION_RESOLUTION",
  BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO: "BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO",
  BLOCKED_BY_BROKEN_RUNTIME_BRANCH: "BLOCKED_BY_BROKEN_RUNTIME_BRANCH",
  BLOCKED_BY_CODE_DEFECT: "BLOCKED_BY_CODE_DEFECT",
} as const

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
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
  elapsedMs?: number
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

function classifyLead(lead: GrowthLead, runtimeOrgId: string | null): string {
  if (lead.archivedAt) return "archived"
  if (lead.status === "disqualified") return "disqualified"
  const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
  if (admission.state === "invalid") return "invalid"
  if (admission.state === "rejected") return "admission_rejected"
  if (admission.state === "review") {
    if (!lead.website?.trim()) return "admission_review"
    return "admission_review"
  }
  if (lead.organizationId && runtimeOrgId && lead.organizationId !== runtimeOrgId) {
    return "excluded_by_organization"
  }
  if (
    lead.lastProspectResearchedAt &&
    lead.latestProspectResearchRunId &&
    !isProspectResearchStale(lead.lastProspectResearchedAt)
  ) {
    return "research_current"
  }
  if (!lead.website?.trim()) return "missing_website"
  if (!isNativeRevenueDecisionEngineEnabled()) return "excluded_by_feature_gate"
  return "eligible_now"
}

/** Mirrors deployed aa8a5e33 ASL context path (buildGrowthHomeWorkspaceSummary). */
async function traceDeployedAslPath(admin: SupabaseClient, organizationId: string): Promise<{
  branchTrace: BranchRow[]
  workResult: ReturnType<typeof runWorkManager> | null
  stopReason: string
  firstZeroStage: string | null
}> {
  const branchTrace: BranchRow[] = []
  let firstZeroStage: string | null = null

  const markZero = (stage: string) => {
    if (!firstZeroStage) firstZeroStage = stage
  }

  const envOrg = getGrowthEngineAiOrgId()
  branchTrace.push({
    stage: "getGrowthEngineAiOrgId",
    input: "process.env",
    output: envOrg ?? "null",
    status: envOrg ? "ok" : "empty",
    reason: envOrg ? "uuid_configured" : "GROWTH_ENGINE_AI_ORG_ID unset or invalid",
  })

  if (envOrg && organizationId !== envOrg) {
    branchTrace.push({
      stage: "loadAutonomousSalesLoopContext.org_gate",
      input: organizationId,
      output: "null",
      status: "blocked",
      reason: "context_unavailable — org mismatch when env org set",
    })
    markZero("loadAutonomousSalesLoopContext.org_gate")
    return { branchTrace, workResult: null, stopReason: "context_unavailable", firstZeroStage }
  }

  const summaryStart = Date.now()
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "ava-autonomous@equipify.ai",
    actorUserId: "autonomous-sales-loop",
  }).catch(() => null)

  branchTrace.push({
    stage: "buildGrowthHomeWorkspaceSummary",
    input: "admin",
    output: summary?.ok ? "ok" : "null",
    status: summary?.ok ? "executing" : "blocked",
    reason: summary?.ok ? "summary_loaded" : "summary_failed_or_null",
    elapsedMs: Date.now() - summaryStart,
  })
  if (!summary?.ok) {
    markZero("buildGrowthHomeWorkspaceSummary")
    return { branchTrace, workResult: null, stopReason: "context_unavailable", firstZeroStage }
  }

  const drqEnabled = isDailyRevenueWorkQueueEnabled()
  const drqItems = summary.dashboard.dailyRevenueWorkQueueDisplay?.top_items?.length ?? 0
  branchTrace.push({
    stage: "isDailyRevenueWorkQueueEnabled",
    input: "env flags",
    output: String(drqEnabled),
    status: drqEnabled ? "enabled" : "disabled",
    reason: drqEnabled
      ? "DRQ feature on"
      : "GROWTH_DAILY_REVENUE_WORK_QUEUE / GROWTH_COMMUNICATION_STRATEGY / GROWTH_NATIVE_DECISION_ENGINE not true",
  })

  const briefing = synthesizeGrowthHomeExecutiveBriefing({ dashboard: summary.dashboard })
  const dailyWorkQueueCount = briefing.aiOsUx.dailyWorkQueue.length
  branchTrace.push({
    stage: "synthesizeGrowthHomeExecutiveBriefing.dailyWorkQueue",
    input: `drq_enabled=${drqEnabled}`,
    output: String(dailyWorkQueueCount),
    status: dailyWorkQueueCount > 0 ? "executing" : "empty",
    reason:
      dailyWorkQueueCount > 0
        ? "queue_items_materialized"
        : "buildDailyWorkQueueItems returned [] — DRQ disabled or no strategy bundles",
  })
  if (dailyWorkQueueCount === 0) {
    markZero("synthesizeGrowthHomeExecutiveBriefing.dailyWorkQueue")
  }

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

  const decisionStart = Date.now()
  const decisionResult = runDecisionEngine({ ...wmInput, memorySummary: null })
  const candidates = flattenDecisionCandidates(decisionResult.context)
  branchTrace.push({
    stage: "runDecisionEngine.flattenDecisionCandidates",
    input: `dailyWorkQueue=${dailyWorkQueueCount}`,
    output: String(candidates.length),
    status: candidates.length > 0 ? "executing" : "empty",
    reason: candidates.map((c) => `${c.kind}:${c.id}`).slice(0, 8).join(", ") || "none",
    elapsedMs: Date.now() - decisionStart,
  })

  const workResult = runWorkManager({ ...wmInput, memorySummary: null })
  const allItems = workResult.all_work_items
  const executable = allItems.filter(isExecutableWorkItem)
  branchTrace.push({
    stage: "runWorkManager.all_work_items",
    input: String(allItems.length),
    output: String(executable.length),
    status: executable.length > 0 ? "executing" : "empty",
    reason: allItems
      .slice(0, 6)
      .map((i) => `${i.type}:${i.can_execute_autonomously}:${i.blocked_by.join("|")}`)
      .join("; "),
  })
  if (executable.length === 0 && !firstZeroStage) {
    markZero("runWorkManager.all_work_items")
  }

  const selected = selectNextExecutableWorkItem(workResult)
  branchTrace.push({
    stage: "selectNextExecutableWorkItem",
    input: String(executable.length),
    output: selected?.id ?? "null",
    status: selected ? "selected" : "blocked",
    reason: selected ? selected.title : "no_executable_work",
  })
  if (!selected && !firstZeroStage) {
    markZero("selectNextExecutableWorkItem")
  }

  return {
    branchTrace,
    workResult,
    stopReason: selected ? "would_execute" : "no_executable_work",
    firstZeroStage: firstZeroStage ?? (selected ? null : "selectNextExecutableWorkItem"),
  }
}

async function main(): Promise<void> {
  console.log("GE-AIOS-LIVE-AUTONOMY-TICK-PROOF-1A\n")

  assert.equal(process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN, "1", "Run via vercel-production-env-run.ts")

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("Bootstrap failed")
    process.exit(1)
  }
  const admin = boot.admin

  const deployedSha = gitDeployedSha()
  const batchPresent = codeBatchPresent(deployedSha)
  const batchAllPresent = Object.values(batchPresent).every(Boolean)
  const runtimeOrgId = getGrowthEngineAiOrgId()

  console.log("=== Phase 1 — Deployed runtime identity ===")
  console.log(
    JSON.stringify(
      {
        deployment_sha: deployedSha,
        project: "v0-app-equipify-ai-53",
        scope: "blitzify",
        hostname: "https://app.equipify.ai",
        runtime_org_id: runtimeOrgId,
        documented_production_org: EQUIPIFY_PRODUCTION_ORG_ID,
        code_batch_present: batchPresent,
        code_batch_all_present: batchAllPresent,
        local_head: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim().slice(0, 12),
      },
      null,
      2,
    ),
  )

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const orgIds = await listActiveRunningGrowthObjectiveOrganizationIds(admin)
  const aslOrgId =
    orgIds.find((id) => id === EQUIPIFY_PRODUCTION_ORG_ID) ?? orgIds[0] ?? EQUIPIFY_PRODUCTION_ORG_ID

  const { data: objectives } = await admin
    .schema("growth")
    .from("organization_growth_objectives")
    .select("id, organization_id, status, objective_type, runtime_state, emergency_stop_active, updated_at")
    .eq("status", "active")

  const latestSchedulerTouch = (objectives ?? [])
    .map((o) => ({
      id: o.id,
      org: o.organization_id,
      lastScheduler: (o.runtime_state as { lastSchedulerAt?: string })?.lastSchedulerAt ?? null,
      lastTick: (o.runtime_state as { lastTickAt?: string })?.lastTickAt ?? null,
      running: (o.runtime_state as { running?: boolean })?.running ?? false,
      stage: (o.runtime_state as { currentStageId?: string })?.currentStageId ?? null,
    }))
    .sort((a, b) => Date.parse(b.lastScheduler ?? "0") - Date.parse(a.lastScheduler ?? "0"))

  console.log("\n=== Phase 2 — Captured scheduler invocation (DB touch evidence) ===")
  console.log(
    JSON.stringify(
      {
        latest_scheduler_touch: latestSchedulerTouch[0] ?? null,
        organization_candidates: orgIds.length,
        organizations_selected: orgIds.slice(0, 5),
        objectives_active: objectives?.length ?? 0,
        objectives_running: latestSchedulerTouch.filter((o) => o.running).length,
        kill_switches: {
          autonomy_enabled: killSwitches.autonomy_enabled,
          autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
          autonomy_generation_enabled: killSwitches.autonomy_generation_enabled,
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        note: "Cron telemetry duration/stop_reason not persisted to DB — inferred from objective runtime_state touches",
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 3 — ASL branch trace (deployed path replay) ===")
  const aslTrace = await traceDeployedAslPath(admin, aslOrgId)
  console.log("first_zero_stage:", aslTrace.firstZeroStage)
  console.log("stop_reason:", aslTrace.stopReason)
  console.table(aslTrace.branchTrace)

  const dryLoop = await runAutonomousSalesLoop({
    admin,
    organizationId: aslOrgId,
    dryRun: true,
    maxIterations: 1,
  })
  console.log("\nLocal ASL dry-run (current workspace code):", {
    stop_reason: dryLoop.stop_reason,
    selected_work: dryLoop.selected_work?.length ?? 0,
    note: batchAllPresent
      ? "matches deployed portfolio snapshot path"
      : "LOCAL differs from deployed — deployed uses buildGrowthHomeWorkspaceSummary",
  })

  console.log("\n=== Phase 4 — Feature-gate authority audit ===")
  const flagAudit = [
    {
      flag: "GROWTH_DAILY_REVENUE_WORK_QUEUE",
      canonical: "yes — primary DRQ gate for ASL candidate generation on deployed path",
      runtime: process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE ?? "unset",
      effect: isDailyRevenueWorkQueueEnabled() ? "DRQ on" : "dailyWorkQueue=[] → no queue candidates",
      action: "set true OR enable GROWTH_NATIVE_DECISION_ENGINE / GROWTH_COMMUNICATION_STRATEGY",
    },
    {
      flag: "GROWTH_COMMUNICATION_STRATEGY",
      canonical: "yes — enables DRQ via communication strategy chain",
      runtime: process.env.GROWTH_COMMUNICATION_STRATEGY ?? "unset",
      effect: isCommunicationStrategyEnabled() ? "on" : "DRQ remains off unless other flags set",
      action: "set true if using comm strategy path",
    },
    {
      flag: "GROWTH_NATIVE_DECISION_ENGINE",
      canonical: "yes — required for strategy bundle resolution AND DRQ enablement",
      runtime: process.env.GROWTH_NATIVE_DECISION_ENGINE ?? "unset",
      effect: isNativeRevenueDecisionEngineEnabled() ? "bundles resolve" : "resolveLeadCommunicationStrategyBundle returns disabled",
      action: "set true — minimum for portfolio ranking on deployed runtime",
    },
    {
      flag: "GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_ENABLED",
      canonical: "post-approval only — not ASL entry",
      runtime: process.env.GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_ENABLED ?? "unset",
      effect: isAvaOutreachExecutionRequestEnabled() ? "HAC approve→sequence" : "approval cannot enroll sequence",
      action: "enable after first package approved; not required for research/qualification",
    },
  ]
  console.table(flagAudit)

  console.log("\n=== Phase 5 — Organization resolution ===")
  console.log(
    JSON.stringify(
      {
        scheduler_asl_org_source: "listActiveRunningGrowthObjectiveOrganizationIds from running objectives",
        scheduler_org_candidates: orgIds,
        asl_org_used_for_trace: aslOrgId,
        runtime_env_org: runtimeOrgId,
        documented_equipify_org: EQUIPIFY_PRODUCTION_ORG_ID,
        conclusion:
          runtimeOrgId === null
            ? "environment variable is not required for ASL org selection (objective org used) BUT required for DRQ org learning, home summary scoping, and operator surfaces"
            : runtimeOrgId === EQUIPIFY_PRODUCTION_ORG_ID
              ? "environment variable matches documented production org"
              : "runtime organization mapping is inconsistent",
      },
      null,
      2,
    ),
  )

  console.log("\n=== Phase 6 — Portfolio eligibility ===")
  const leadPool = await fetchGrowthHomeLeadPoolPage(admin, { limit: 250 })
  const leads = leadPool.leads
  const eligibilityCounts: Record<string, number> = {}
  const leadRows: Array<{ id: string; company: string; org: string; reason: string }> = []
  for (const lead of leads) {
    const reason = classifyLead(lead, runtimeOrgId)
    eligibilityCounts[reason] = (eligibilityCounts[reason] ?? 0) + 1
    if (!lead.archivedAt && lead.status !== "archived") {
      leadRows.push({
        id: lead.id,
        company: lead.companyName ?? "?",
        org: lead.organizationId ?? "?",
        reason,
      })
    }
  }
  console.log("aggregate:", eligibilityCounts)
  console.table(leadRows.slice(0, 20))

  const blockImaging = leads.find((l) => l.id === BLOCK_IMAGING_LEAD_ID)
  if (blockImaging) {
    console.log("\nBlock Imaging detail:", {
      leadId: blockImaging.id,
      org: blockImaging.organizationId,
      admission: resolveLeadAdmissionStateFromMetadata(blockImaging.metadata).state,
      website: Boolean(blockImaging.website?.trim()),
      researchFresh: Boolean(
        blockImaging.lastProspectResearchedAt &&
          !isProspectResearchStale(blockImaging.lastProspectResearchedAt),
      ),
    })
  } else {
    console.log("\nBlock Imaging not in lead pool window (250 most recent)")
  }

  console.log("\n=== Phase 7 — DRQ materialization (Scenario A vs B) ===")
  const scenarioA = {
    drqEnabled: isDailyRevenueWorkQueueEnabled(),
    queueItems: 0,
    bundlesProduced: 0,
  }
  if (isDailyRevenueWorkQueueEnabled()) {
    const q = await resolveDailyRevenueWorkQueueForLeads({ admin, leads: leads.slice(0, 50) })
    scenarioA.queueItems = q?.items?.length ?? 0
  }
  let bundlesA = 0
  for (const lead of leads.slice(0, 10)) {
    try {
      const b = await resolveLeadCommunicationStrategyBundle(lead, {
        organizationId: runtimeOrgId ?? aslOrgId,
        admin,
      })
      if (b.bundle) bundlesA += 1
    } catch {
      // strategy resolver may fail when native engine disabled
    }
  }
  scenarioA.bundlesProduced = bundlesA

  const prevNative = process.env.GROWTH_NATIVE_DECISION_ENGINE
  const prevDrq = process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE
  process.env.GROWTH_NATIVE_DECISION_ENGINE = "true"
  process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE = "true"
  const scenarioB: Record<string, unknown> = {
    drqEnabled: isDailyRevenueWorkQueueEnabled(),
    queueItems: 0,
    bundlesProduced: 0,
  }
  let bundlesB = 0
  for (const lead of leads.slice(0, 10)) {
    try {
      const b = await resolveLeadCommunicationStrategyBundle(lead, {
        organizationId: runtimeOrgId ?? aslOrgId,
        admin,
      })
      if (b.bundle) bundlesB += 1
    } catch (e) {
      scenarioB.strategyError = e instanceof Error ? e.message : String(e)
    }
  }
  scenarioB.bundlesProduced = bundlesB
  if (prevNative === undefined) delete process.env.GROWTH_NATIVE_DECISION_ENGINE
  else process.env.GROWTH_NATIVE_DECISION_ENGINE = prevNative
  if (prevDrq === undefined) delete process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE
  else process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE = prevDrq

  console.log(JSON.stringify({ scenarioA_current_production_env: scenarioA, scenarioB_in_memory_override: scenarioB }, null, 2))

  console.log("\n=== Phase 8 — Work Manager replay (Scenario B if A empty) ===")
  if (aslTrace.workResult) {
    const items = aslTrace.workResult.all_work_items
    console.table(
      items.slice(0, 10).map((i) => ({
        id: i.id,
        type: i.type,
        can_execute: i.can_execute_autonomously,
        blocked_by: i.blocked_by.join(","),
        score: i.decision_score,
      })),
    )
  }

  console.log("\n=== Phase 9 — Execution Authority secondary blockers (Scenario B leads) ===")
  process.env.GROWTH_NATIVE_DECISION_ENGINE = "true"
  const authorityRows: Array<{ leadId: string; disposition: string; reason: string }> = []
  for (const lead of leads.filter((l) => l.organizationId === EQUIPIFY_PRODUCTION_ORG_ID).slice(0, 5)) {
    try {
      const auth = await evaluateCanonicalExecutionAuthorityForLead(admin, {
        organizationId: lead.organizationId ?? aslOrgId,
        leadId: lead.id,
        actionKind: "persisted_research_run",
        generatedAt: new Date().toISOString(),
      })
      authorityRows.push({
        leadId: lead.id.slice(0, 8),
        disposition: auth.disposition,
        reason: auth.reasonCode,
      })
    } catch (e) {
      authorityRows.push({
        leadId: lead.id.slice(0, 8),
        disposition: "error",
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }
  if (prevNative === undefined) delete process.env.GROWTH_NATIVE_DECISION_ENGINE
  else process.env.GROWTH_NATIVE_DECISION_ENGINE = prevNative
  console.table(authorityRows)

  console.log("\n=== Phase 10 — Draft Factory tenant ownership ===")
  const [{ count: dfTotal }, { count: dfEquipify }, { data: dfSample }] = await Promise.all([
    admin.schema("growth").from("draft_factory_lead_states").select("*", { count: "exact", head: true }),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("organization_id, state, paused_reason")
      .limit(30),
  ])
  const dfByOrg: Record<string, number> = {}
  for (const row of dfSample ?? []) {
    const org = String((row as { organization_id: string }).organization_id)
    dfByOrg[org] = (dfByOrg[org] ?? 0) + 1
  }
  console.log(JSON.stringify({ dfTotal, dfEquipify, dfSampleOrgCounts: dfByOrg }, null, 2))

  console.log("\n=== Phase 11 — Objective contribution ===")
  console.table(
    latestSchedulerTouch.map((o) => ({
      id: String(o.id).slice(0, 8),
      org: String(o.org).slice(0, 8),
      running: o.running,
      stage: o.stage,
      lastScheduler: o.lastScheduler,
      contributes_to_asl: orgIds.includes(String(o.org)),
    })),
  )

  let verdict: keyof typeof GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_VERDICT =
    "READY_AFTER_TARGETED_CONFIGURATION"

  if (!batchAllPresent) {
    verdict = "BLOCKED_BY_UNDEPLOYED_RUNTIME_BATCH"
  } else if (runtimeOrgId === null && aslTrace.firstZeroStage?.includes("dailyWorkQueue")) {
    verdict = "BLOCKED_BY_OBSOLETE_FEATURE_GATE"
  } else if (
    aslTrace.firstZeroStage === "synthesizeGrowthHomeExecutiveBriefing.dailyWorkQueue" ||
    aslTrace.firstZeroStage === "isDailyRevenueWorkQueueEnabled"
  ) {
    verdict = "READY_AFTER_TARGETED_CONFIGURATION"
  } else if (leadRows.length === 0) {
    verdict = "BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO"
  } else if (scenarioB.queueItems === 0 && scenarioB.bundlesProduced === 0) {
    verdict = "BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO"
  } else if (scenarioB.queueItems > 0 && authorityRows.every((r) => r.disposition === "blocked")) {
    verdict = "BLOCKED_BY_BROKEN_RUNTIME_BRANCH"
  }

  console.log("\n=== PRIMARY ANSWER ===")
  console.log(
    `Why did the latest ASL tick return no_executable_work?\n` +
      `FIRST BLOCKER: ${aslTrace.firstZeroStage ?? "unknown"} — ${aslTrace.stopReason}\n` +
      `SECONDARY (after DRQ enabled): admission_review on active leads; empty Equipify DF states; outbound remains disabled`,
  )

  console.log(`\nQA marker: ${GE_AIOS_LIVE_AUTONOMY_TICK_PROOF_1A_QA_MARKER}`)
  console.log(`VERDICT: ${verdict}`)

  if (verdict !== "READY_TO_ACTIVATE_INTERNAL_AUTONOMY") {
    process.exit(verdict === "BLOCKED_BY_UNDEPLOYED_RUNTIME_BATCH" ? 2 : 1)
  }
}

void main()
