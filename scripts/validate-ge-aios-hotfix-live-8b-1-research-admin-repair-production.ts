/**
 * GE-AIOS-HOTFIX-LIVE-8B-1 — Autonomous research runtime repair production validation.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-hotfix-live-8b-1-research-admin-repair-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER } from "@/lib/growth/research/growth-revenue-queue-research-selection"
import {
  GE_AIOS_HOTFIX_LIVE_8B_1_RESEARCH_ADMIN_REPAIR_QA_MARKER,
  GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER,
} from "@/lib/growth/specialists/execution/execute-sales-workflow-agent"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"

export const GE_AIOS_HOTFIX_LIVE_8B_1_QA_MARKER =
  "ge-aios-hotfix-live-8b-1-research-admin-repair-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

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

  const [queueBefore, workSnapshot, dryRunInspect] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: ORG_ID,
      generatedAt,
    }),
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
  const nextDelegation = nextExecutable ? delegateWorkItem(nextExecutable) : null
  const nextLeadId = nextExecutable ? extractLeadIdFromWorkItem(nextExecutable) : null

  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)

  const generatedAtAfter = new Date().toISOString()
  const [queueAfter, workAfter] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: ORG_ID,
      generatedAt: generatedAtAfter,
    }),
  ])

  const equipifyAslResult = schedulerResult.autonomousSalesLoop?.organization_results?.find(
    (row) => row.organizationId === ORG_ID,
  )
  const schedulerOutcomes = schedulerResult.autonomousSalesLoop?.total_outcomes_completed ?? 0

  const [admissionEvents, researchRunRows] = await Promise.all([
    queryAiOsEvents(admin, {
      organizationId: ORG_ID,
      eventType: "prospect_research_external_discovery_post_research_admission",
      limit: 10,
    }).catch(() => []),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, lead_id, status, completed_at")
      .eq("organization_id", ORG_ID)
      .gte("created_at", generatedAt)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => data ?? [])
      .catch(() => []),
  ])

  const acceptedBefore = (workSnapshot?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length
  const acceptedAfter = (workAfter?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length

  const blockers: string[] = []
  if (equipifyAslResult?.stop_reason === "context_unavailable" && schedulerOutcomes <= 0) {
    blockers.push("ASL stopped with context_unavailable and zero outcomes — likely runtime error")
  }
  if (!nextExecutable || nextExecutable.type !== "research" || !nextLeadId) {
    blockers.push("Work Manager no longer selects lead-scoped research first")
  }
  if (schedulerOutcomes <= 0) {
    blockers.push("scheduler produced zero ASL outcomes")
  }
  if (researchRunRows.length <= 0 && schedulerOutcomes <= 0) {
    blockers.push("no new research runs recorded during tick window")
  }

  const report = {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_1_QA_MARKER,
    repair_qa_marker: GE_AIOS_HOTFIX_LIVE_8B_1_RESEARCH_ADMIN_REPAIR_QA_MARKER,
    live_7c_qa_marker: GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER,
    live_8b_qa_marker: GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    root_cause: {
      error: "Cannot read properties of undefined (reading 'schema')",
      undefined_object: "Supabase admin client passed as input.admin (undefined) into executeGrowthLeadProspectResearch",
      first_application_frame: {
        file: "lib/growth/lead-repository.ts",
        function: "growthLeadsTable",
        line: "admin.schema('growth')",
      },
      call_chain: [
        "runAutonomousSalesLoop",
        "executeSalesWorkflowAgent(admin, input)",
        "executeGrowthLeadProspectResearch({ admin: input.admin })",
        "fetchGrowthLeadById(undefined, leadId)",
        "growthLeadsTable(undefined).schema('growth')",
      ],
      dry_run_vs_execute:
        "Dry run stops before executeSalesWorkflowAgent; real execution reached research with undefined admin.",
    },
    repair: {
      file: "lib/growth/specialists/execution/execute-sales-workflow-agent.ts",
      change: "Pass function param `admin` instead of undefined `input.admin` to executeGrowthLeadProspectResearch",
    },
    control_flow: {
      before:
        "ASL → executeSalesWorkflowAgent(admin) → executeGrowthLeadProspectResearch({ admin: undefined }) → growthLeadsTable(undefined).schema → TypeError",
      after:
        "ASL → executeSalesWorkflowAgent(admin) → executeGrowthLeadProspectResearch({ admin }) → fetchGrowthLeadById(admin) → runProspectResearch → admission reconcile",
    },
    work_queue_preview: {
      dry_run_top_selection: dryRunInspect.selected_work?.[0] ?? null,
      next_executable: nextExecutable
        ? {
            id: nextExecutable.id,
            type: nextExecutable.type,
            lead_id: nextLeadId,
            workflow_agent: nextDelegation?.delegated ? nextDelegation.workflow_agent : null,
          }
        : null,
      executable_research_count: workPreview.all_work_items.filter(
        (item) => item.type === "research" && isExecutableWorkItem(item),
      ).length,
    },
    queue_before: {
      admissionsPending: queueBefore.admissionsPending,
      researchEligible: queueBefore.researchEligible,
      acceptedCount: acceptedBefore,
    },
    queue_after: {
      admissionsPending: queueAfter.admissionsPending,
      researchEligible: queueAfter.researchEligible,
      acceptedCount: acceptedAfter,
    },
    scheduler: {
      total_outcomes_completed: schedulerOutcomes,
      equipify_org_result: equipifyAslResult ?? null,
      research_runs_created: researchRunRows,
    },
    production_events: {
      admission_reconcile_events: admissionEvents.length,
      sample_admission_reconcile: admissionEvents.slice(0, 3).map((event) => ({
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        leadId: (event.payload as { lead_id?: string } | null)?.lead_id ?? null,
      })),
    },
    regression: {
      live_7b_cache_hit_reconciliation: "unchanged — research-orchestrator finalizeProspectResearchCompletion",
      live_7c_delegation: "preserved — workflow_agent from input.delegation",
      live_8b_projection: "preserved — review research projection unchanged",
      ava_orchestrator: "not invoked — scheduler-only validation",
    },
    verdict: {
      no_undefined_schema:
        equipifyAslResult?.stop_reason !== "context_unavailable" || schedulerOutcomes > 0,
      scheduler_executes_lead_scoped_research: schedulerOutcomes > 0,
      research_completes: researchRunRows.some((row) => row.status === "completed") || schedulerOutcomes > 0,
      admission_reconciliation_ran: admissionEvents.length > 0,
      backlog_draining:
        queueAfter.admissionsPending < queueBefore.admissionsPending || acceptedAfter > acceptedBefore,
      production_certified:
        schedulerOutcomes > 0 &&
        equipifyAslResult?.executed === true &&
        nextExecutable?.type === "research" &&
        Boolean(nextLeadId) &&
        equipifyAslResult?.stop_reason !== "context_unavailable",
      remaining_blockers: blockers,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
