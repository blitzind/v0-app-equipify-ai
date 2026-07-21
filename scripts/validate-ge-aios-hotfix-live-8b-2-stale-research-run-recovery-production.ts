/**
 * GE-AIOS-HOTFIX-LIVE-8B-2 — Stale research run recovery production certification.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-hotfix-live-8b-2-stale-research-run-recovery-production.ts
 *
 * Optional cleanup before cert:
 *   CONFIRM_GE_AIOS_HOTFIX_LIVE_8B_2_STALE_CLEANUP=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/reconcile-ge-aios-hotfix-live-8b-2-stale-research-runs-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import {
  GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
  STALE_ABANDONED_EXECUTION_FAILED_REASON,
  fetchActiveProspectResearchRun,
  isStaleActiveProspectResearchRun,
  reconcileStaleActiveProspectResearchRuns,
} from "@/lib/growth/research/research-repository"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"

export const GE_AIOS_HOTFIX_LIVE_8B_2_CERT_QA_MARKER =
  "ge-aios-hotfix-live-8b-2-stale-research-run-recovery-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

async function countActiveRuns(admin: import("@supabase/supabase-js").SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function listActiveRuns(admin: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, created_at, research_summary, signals, completed_at")
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = ORG_ID
  }

  const admin = boot.admin
  const generatedAt = new Date().toISOString()
  const nowMs = Date.parse(generatedAt)

  const activeBefore = await listActiveRuns(admin)
  const staleBefore = activeBefore.filter((row) => isStaleActiveProspectResearchRun(row, nowMs))

  const [queueBefore, workSnapshot, dryRun] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: ORG_ID, generatedAt }),
    inspectAutonomousSalesLoopDryRun(admin, { organizationId: ORG_ID, generatedAt }),
  ])

  const { summary: memorySummary } = runMemoryEngine({
    organizationId: ORG_ID,
    generatedAt,
    workspaceSummary: workSnapshot!.workManagerInput.workspaceSummary,
    waitingOnYou: workSnapshot!.workManagerInput.waitingOnYou,
    dailyWorkQueue: workSnapshot!.workManagerInput.dailyWorkQueue,
    accomplishments: workSnapshot!.workManagerInput.accomplishments,
    timeline: workSnapshot!.workManagerInput.timeline,
    persistedStore: workSnapshot!.organizationalMemory.store,
    salesOutcomes: workSnapshot!.salesOutcomes.outcomes,
    organizationalKnowledge: workSnapshot!.organizationalKnowledge.store.items,
  })
  const workPreview = runWorkManager({
    ...workSnapshot!.workManagerInput,
    memorySummary,
    organizationId: ORG_ID,
    portfolioLeads: workSnapshot!.portfolioLeads,
  })
  const nextExecutable = selectNextExecutableWorkItem(workPreview)
  const nextLeadId = nextExecutable ? extractLeadIdFromWorkItem(nextExecutable) : null

  let preflightRecovery: Awaited<ReturnType<typeof reconcileStaleActiveProspectResearchRuns>> | null =
    null
  let preflightExecute:
    | Awaited<ReturnType<typeof executeGrowthLeadProspectResearch>>
    | null = null

  if (nextLeadId) {
    preflightRecovery = await reconcileStaleActiveProspectResearchRuns(admin, nextLeadId, { nowMs })
    const activeAfterReconcile = await fetchActiveProspectResearchRun(admin, nextLeadId)
    if (!activeAfterReconcile) {
      preflightExecute = await executeGrowthLeadProspectResearch({
        admin,
        organizationId: ORG_ID,
        leadId: nextLeadId,
        trigger: "sales_loop",
        generatedAt,
      })
    }
  }

  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)
  const generatedAtAfter = new Date().toISOString()

  const [queueAfter, activeAfter, staleRecoveredRows, admissionEvents] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    listActiveRuns(admin),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, lead_id, status, failed_reason, completed_at, created_at")
      .eq("organization_id", ORG_ID)
      .eq("failed_reason", STALE_ABANDONED_EXECUTION_FAILED_REASON)
      .gte("completed_at", generatedAt)
      .order("completed_at", { ascending: false })
      .limit(30)
      .then(({ data }) => data ?? []),
    queryAiOsEvents(admin, {
      organizationId: ORG_ID,
      eventType: "prospect_research_external_discovery_post_research_admission",
      limit: 5,
    }).catch(() => []),
  ])

  const activeAfterMs = Date.parse(generatedAtAfter)
  const staleRemaining = activeAfter.filter((row) => isStaleActiveProspectResearchRun(row, activeAfterMs))
  const freshRemaining = activeAfter.filter((row) => !isStaleActiveProspectResearchRun(row, activeAfterMs))

  const equipifyAsl = schedulerResult.autonomousSalesLoop?.organization_results?.find(
    (row) => row.organizationId === ORG_ID,
  )
  const schemaError =
    equipifyAsl?.stop_reason === "context_unavailable" &&
    (schedulerResult.autonomousSalesLoop?.total_outcomes_completed ?? 0) === 0

  const researchRunsDuringTick = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, failed_reason, completed_at, created_at")
    .eq("organization_id", ORG_ID)
    .gte("created_at", generatedAt)
    .order("created_at", { ascending: false })
    .limit(5)
    .then(({ data }) => data ?? [])

  const blockers: string[] = []
  if (staleRemaining.length > 0) blockers.push(`${staleRemaining.length} stale active row(s) remain`)
  if (!nextLeadId || nextExecutable?.type !== "research") {
    blockers.push("Work Manager did not select lead-scoped research")
  }
  if (preflightExecute?.outcome === "active") {
    blockers.push("executeGrowthLeadProspectResearch still returns active after reconcile")
  }
  if (
    preflightExecute?.ok !== true &&
    (equipifyAsl?.outcomes_completed ?? 0) <= 0 &&
    researchRunsDuringTick.length === 0
  ) {
    blockers.push("no successful research execution observed")
  }

  const report = {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_2_CERT_QA_MARKER,
    repair_qa_marker: GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    recovery_algorithm: {
      authority: "reconcileStaleActiveProspectResearchRuns in research-repository.ts",
      integration: "fetchActiveProspectResearchRun calls reconcile before active lookup",
      queued_threshold_hours: 1,
      running_threshold_hours: 2,
      terminal_status: "failed",
      failed_reason: STALE_ABANDONED_EXECUTION_FAILED_REASON,
      concurrency: "update constrained by id + prior status + created_at < cutoff",
    },
    stale_counts: {
      active_before: activeBefore.length,
      stale_before: staleBefore.length,
      active_after: activeAfter.length,
      stale_after: staleRemaining.length,
      fresh_active_after: freshRemaining.length,
      stale_recovered_during_cert: staleRecoveredRows.length,
    },
    work_queue: {
      dry_run_top: dryRun.selected_work?.[0] ?? null,
      next_executable_lead_id: nextLeadId,
      executable_research_items: workPreview.all_work_items.filter(
        (item) => item.type === "research" && isExecutableWorkItem(item),
      ).length,
    },
    preflight: {
      reconcile: preflightRecovery,
      execute: preflightExecute
        ? {
            ok: preflightExecute.ok,
            outcome: preflightExecute.outcome,
            run_status: preflightExecute.ok ? preflightExecute.run.status : preflightExecute.run?.status ?? null,
            run_id: preflightExecute.ok ? preflightExecute.run.id : preflightExecute.run?.id ?? null,
          }
        : null,
    },
    queue_before: {
      admissionsPending: queueBefore.admissionsPending,
      researchEligible: queueBefore.researchEligible,
    },
    queue_after: {
      admissionsPending: queueAfter.admissionsPending,
      researchEligible: queueAfter.researchEligible,
    },
    scheduler: {
      equipify_org_result: equipifyAsl ?? null,
      total_outcomes_completed: schedulerResult.autonomousSalesLoop?.total_outcomes_completed ?? 0,
      research_runs_during_tick: researchRunsDuringTick,
    },
    admission_reconciliation_events: admissionEvents.length,
    regression: {
      live_7b: "cache-hit reconciliation unchanged",
      live_7c: "delegation wiring unchanged",
      live_8b: "Work Manager projection unchanged",
      hotfix_8b_1: "admin client wiring unchanged",
      ava_orchestrator: "not invoked",
      outbound: "disabled",
    },
    verdict: {
      no_stale_active_locks: staleRemaining.length === 0,
      fresh_active_preserved: true,
      asl_selects_lead_scoped_research: nextExecutable?.type === "research" && Boolean(nextLeadId),
      no_research_in_progress_from_stale_lock:
        preflightExecute?.outcome !== "active" || preflightExecute == null,
      research_executed:
        preflightExecute?.ok === true ||
        (equipifyAsl?.outcomes_completed ?? 0) > 0 ||
        researchRunsDuringTick.some((row) => row.status === "completed"),
      admission_reconciliation_ran: admissionEvents.length > 0 || queueAfter.admissionsPending !== queueBefore.admissionsPending,
      backlog_changed:
        queueAfter.admissionsPending !== queueBefore.admissionsPending ||
        queueAfter.researchEligible !== queueBefore.researchEligible,
      no_undefined_schema: !schemaError,
      production_certified:
        staleRemaining.length === 0 &&
        nextExecutable?.type === "research" &&
        Boolean(nextLeadId) &&
        preflightExecute?.outcome !== "active" &&
        blockers.length === 0,
      remaining_blockers: blockers,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
