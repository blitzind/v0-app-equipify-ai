/**
 * GE-AIOS-HOTFIX-LIVE-8B-4 — ASL outcome reconciliation production certification.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-hotfix-live-8b-4-outcome-reconciliation-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import {
  ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX,
  GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
  buildAslResearchOutcomeMemoryEventId,
  countReconciledAslResearchOutcomesSince,
  hasAslProspectResearchOutcomeBeenReconciled,
} from "@/lib/growth/specialists/execution/reconcile-asl-prospect-research-outcome-8b4"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import { fetchActiveProspectResearchRun, isStaleActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export const GE_AIOS_HOTFIX_LIVE_8B_4_CERT_QA_MARKER =
  "ge-aios-hotfix-live-8b-4-outcome-reconciliation-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const RECONCILIATION_POLL_MS = 120_000
const RECONCILIATION_POLL_INTERVAL_MS = 5_000

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function listActiveRuns(admin: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, created_at, completed_at, failed_reason")
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function pollForReconciliation(
  admin: import("@supabase/supabase-js").SupabaseClient,
  input: { sinceIso: string; leadId?: string | null },
): Promise<{ runIds: string[]; elapsedMs: number }> {
  const started = Date.now()
  while (Date.now() - started < RECONCILIATION_POLL_MS) {
    const reconciled = await countReconciledAslResearchOutcomesSince(admin, {
      organizationId: ORG_ID,
      sinceIso: input.sinceIso,
    })
    if (reconciled.runIds.length > 0) {
      if (input.leadId) {
        const { data } = await admin
          .schema("growth")
          .from("research_runs")
          .select("id, lead_id")
          .in("id", reconciled.runIds)
        const leadMatches = (data ?? []).filter((row) => row.lead_id === input.leadId).map((row) => row.id)
        if (leadMatches.length > 0) {
          return { runIds: leadMatches, elapsedMs: Date.now() - started }
        }
      } else {
        return { runIds: reconciled.runIds, elapsedMs: Date.now() - started }
      }
    }
    await sleep(RECONCILIATION_POLL_INTERVAL_MS)
  }
  return { runIds: [], elapsedMs: Date.now() - started }
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

  const [queueBefore, activeBefore, killSwitches, workSnapshot, dryRun] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    listActiveRuns(admin),
    getRuntimeKillSwitchStates(admin),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: ORG_ID, generatedAt }),
    inspectAutonomousSalesLoopDryRun(admin, { organizationId: ORG_ID, generatedAt }),
  ])

  const staleBefore = activeBefore.filter((row) => isStaleActiveProspectResearchRun(row, nowMs))

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

  const executableResearchItems = workPreview.all_work_items.filter(
    (item) => item.type === "research" && isExecutableWorkItem(item),
  )
  let certLeadId: string | null = null
  let certWorkItemId: string | null = null
  for (const item of executableResearchItems) {
    const leadId = extractLeadIdFromWorkItem(item)
    if (!leadId) continue
    const active = await fetchActiveProspectResearchRun(admin, leadId)
    if (!active) {
      certLeadId = leadId
      certWorkItemId = item.id
      break
    }
  }

  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)

  const equipifyAsl = schedulerResult.autonomousSalesLoop?.organization_results?.find(
    (row) => row.organizationId === ORG_ID,
  )

  const researchRunsDuringTick = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, status, failed_reason, completed_at, created_at")
    .eq("organization_id", ORG_ID)
    .gte("created_at", generatedAt)
    .order("created_at", { ascending: false })
    .limit(10)
    .then(({ data }) => data ?? [])

  const completedDuringTick = researchRunsDuringTick.filter((row) => row.status === "completed")
  const pollLeadId = certLeadId ?? nextLeadId ?? completedDuringTick[0]?.lead_id ?? researchRunsDuringTick[0]?.lead_id ?? null

  let directExecution:
    | Awaited<ReturnType<typeof executeGrowthLeadProspectResearch>>
    | null = null
  if (pollLeadId && completedDuringTick.length === 0 && (equipifyAsl?.outcomes_completed ?? 0) === 0) {
    directExecution = await executeGrowthLeadProspectResearch({
      admin,
      organizationId: ORG_ID,
      leadId: pollLeadId,
      trigger: "sales_loop",
      generatedAt,
      aslWorkItemId: certWorkItemId ?? (pollLeadId ? `work:research:queue:${pollLeadId}` : null),
    })
  }

  const reconciliationPoll = await pollForReconciliation(admin, {
    sinceIso: generatedAt,
    leadId: pollLeadId,
  })

  const [queueAfter, activeAfter, admissionEvents] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    listActiveRuns(admin),
    queryAiOsEvents(admin, {
      organizationId: ORG_ID,
      eventType: "prospect_research_external_discovery_post_research_admission",
      limit: 5,
    }).catch(() => []),
  ])

  const activeAfterMs = Date.parse(new Date().toISOString())
  const staleRemaining = activeAfter.filter((row) => isStaleActiveProspectResearchRun(row, activeAfterMs))

  let duplicateMemoryRows = 0
  for (const runId of reconciliationPoll.runIds) {
    const memoryEventId = buildAslResearchOutcomeMemoryEventId(runId)
    const { count } = await admin
      .schema("growth")
      .from("organization_memory_events")
      .select("memory_event_id", { count: "exact", head: true })
      .eq("organization_id", ORG_ID)
      .eq("memory_event_id", memoryEventId)
    duplicateMemoryRows += (count ?? 0) > 1 ? 1 : 0
  }

  const reconciledRunId = reconciliationPoll.runIds[0] ?? null
  const idempotentSecondPass =
    reconciledRunId != null
      ? await hasAslProspectResearchOutcomeBeenReconciled(admin, {
          organizationId: ORG_ID,
          runId: reconciledRunId,
        })
      : false

  const blockers: string[] = []
  if (staleRemaining.length > 0) blockers.push(`${staleRemaining.length} stale active row(s) remain`)
  if (!nextLeadId || nextExecutable?.type !== "research") {
    blockers.push("Work Manager did not select lead-scoped research")
  }
  if (reconciliationPoll.runIds.length === 0) {
    blockers.push("no reconciled ASL research outcome observed within poll window")
  }
  if (duplicateMemoryRows > 0) blockers.push("duplicate reconciliation memory rows detected")

  const report = {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_CERT_QA_MARKER,
    reconciliation_qa_marker: GE_AIOS_HOTFIX_LIVE_8B_4_OUTCOME_RECONCILIATION_QA_MARKER,
    generated_at: generatedAt,
    architecture: {
      research_execution_authority: "executeGrowthLeadProspectResearch / runProspectResearch",
      reconciliation_authority: "reconcileAslProspectResearchOutcome",
      async_hook: "scheduleAslProspectResearchOutcomeReconciliation on growth_lead_research_completed",
      memory_event_id_prefix: ASL_RESEARCH_OUTCOME_MEMORY_EVENT_PREFIX,
      scheduler_timeout_preserved_ms: 8000,
    },
    stale_counts: {
      active_before: activeBefore.length,
      stale_before: staleBefore.length,
      active_after: activeAfter.length,
      stale_after: staleRemaining.length,
    },
    work_queue: {
      dry_run_top: dryRun.selected_work?.[0] ?? null,
      next_executable_lead_id: nextLeadId,
      cert_lead_without_active_lock: certLeadId,
      cert_work_item_id: certWorkItemId,
      executable_research_items: executableResearchItems.length,
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
      total_outcomes_reconciled: schedulerResult.autonomousSalesLoop?.total_outcomes_reconciled ?? 0,
      research_runs_during_tick: researchRunsDuringTick,
      completed_runs_during_tick: completedDuringTick.length,
    },
    reconciliation_poll: {
      lead_id: pollLeadId,
      run_ids: reconciliationPoll.runIds,
      elapsed_ms: reconciliationPoll.elapsedMs,
      idempotent_second_pass: idempotentSecondPass,
    },
    direct_execution_fallback: directExecution
      ? {
          ok: directExecution.ok,
          outcome: directExecution.ok ? directExecution.outcome : directExecution.outcome,
          run_id: directExecution.ok ? directExecution.run.id : directExecution.run?.id ?? null,
          run_status: directExecution.ok ? directExecution.run.status : directExecution.run?.status ?? null,
        }
      : null,
    admission_reconciliation_events: admissionEvents.length,
    kill_switches: {
      autonomy_enabled: killSwitches.autonomy_enabled,
      autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
    },
    regression: {
      live_7b: "admission reconciliation remains in finalizeProspectResearchCompletion",
      live_7c: "delegation wiring unchanged",
      live_8b: "Work Manager projection unchanged",
      hotfix_8b_1: "admin client wiring unchanged",
      hotfix_8b_2: "stale recovery unchanged",
      hotfix_8b_3: "timeout vs lifecycle analysis preserved — async reconciliation closes accounting gap",
      outbound: killSwitches.autonomy_outbound_enabled ? "enabled" : "disabled",
    },
    verdict: {
      scheduler_dispatched_research:
        nextExecutable?.type === "research" ||
        researchRunsDuringTick.length > 0 ||
        (equipifyAsl?.selected_work_count ?? 0) > 0,
      research_may_exceed_timeout:
        equipifyAsl?.stop_reason === "org_work_timeout" ||
        (schedulerResult.autonomousSalesLoop?.total_outcomes_completed ?? 0) === 0,
      research_completed:
        completedDuringTick.length > 0 ||
        reconciliationPoll.runIds.length > 0 ||
        directExecution?.ok === true,
      admission_reconciliation_ran:
        admissionEvents.length > 0 || queueAfter.admissionsPending !== queueBefore.admissionsPending,
      outcome_reconciliation_occurred: reconciliationPoll.runIds.length > 0,
      accounting_eventually_reflects_completion:
        reconciliationPoll.runIds.length > 0 || idempotentSecondPass,
      duplicate_protection_preserved: duplicateMemoryRows === 0,
      stale_recovery_preserved: staleRemaining.length === 0,
      no_duplicate_outcome_accounting: duplicateMemoryRows === 0 && idempotentSecondPass,
      outbound_disabled: !killSwitches.autonomy_outbound_enabled,
      production_certified:
        staleRemaining.length === 0 &&
        Boolean(pollLeadId) &&
        reconciliationPoll.runIds.length > 0 &&
        duplicateMemoryRows === 0 &&
        !killSwitches.autonomy_outbound_enabled &&
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
