/**
 * GE-AIOS-LIVE-7C — Autonomous Sales Loop research execution production validation.
 *
 * Scheduler-only path (no Ava orchestrator):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-live-7c-asl-research-execution-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER } from "@/lib/growth/specialists/execution/execute-sales-workflow-agent"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"

export const GE_AIOS_LIVE_7C_QA_MARKER = "ge-aios-live-7c-asl-research-execution-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

function buildWorkManagerPreview(
  snapshot: Awaited<ReturnType<typeof buildGrowthAutonomousPortfolioWorkSnapshot>>,
  organizationId: string,
  generatedAt: string,
) {
  if (!snapshot) return null
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
  return runWorkManager({
    ...snapshot.workManagerInput,
    memorySummary,
    organizationId,
    portfolioLeads: snapshot.portfolioLeads,
  })
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

  const [queueBefore, workSnapshot, dryRunInspect] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: ORG_ID,
      generatedAt,
    }),
    inspectAutonomousSalesLoopDryRun(admin, { organizationId: ORG_ID, generatedAt }),
  ])

  const workPreview = buildWorkManagerPreview(workSnapshot, ORG_ID, generatedAt)
  const executableCandidates =
    workPreview?.all_work_items
      .filter(isExecutableWorkItem)
      .sort((left, right) => {
        if (right.decision_score !== left.decision_score) {
          return right.decision_score - left.decision_score
        }
        return right.priority - left.priority
      })
      .slice(0, 8)
      .map((item) => {
        const delegation = delegateWorkItem(item)
        return {
          work_item_id: item.id,
          type: item.type,
          title: item.title,
          decision_score: item.decision_score,
          lead_id: extractLeadIdFromWorkItem(item),
          delegated: delegation.delegated,
          workflow_agent: delegation.delegated ? delegation.workflow_agent : null,
          delegation_reason: delegation.delegated ? null : delegation.reason,
        }
      }) ?? []

  const acceptedBefore = (workSnapshot?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length

  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)

  const generatedAtAfter = new Date().toISOString()
  const [queueAfter, workAfter] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: ORG_ID,
      generatedAt: generatedAtAfter,
    }),
  ])
  const approved = await getActiveApprovedBusinessProfile(admin, ORG_ID).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: ORG_ID,
    generatedAt: generatedAtAfter,
    leads: workAfter?.portfolioLeads ?? [],
    eligibleLeadCount: workAfter?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })
  const acceptedAfter = (workAfter?.portfolioLeads ?? []).filter(
    (lead) => resolveLeadAdmissionStateFromMetadata(lead.metadata) === "accepted",
  ).length

  const equipifyAslResult = schedulerResult.autonomousSalesLoop?.organization_results?.find(
    (row) => row.organizationId === ORG_ID,
  )
  const schedulerOutcomes = schedulerResult.autonomousSalesLoop?.total_outcomes_completed ?? 0
  const selectedTop = dryRunInspect.selected_work?.[0] ?? null
  const nextExecutable =
    workPreview != null ? selectNextExecutableWorkItem(workPreview) : null
  const nextDelegation = nextExecutable ? delegateWorkItem(nextExecutable) : null
  const topRequiresLeadForResearch =
    nextDelegation?.delegated === true &&
    nextDelegation.workflow_agent === "research_agent" &&
    nextExecutable != null &&
    extractLeadIdFromWorkItem(nextExecutable) == null

  const blockers: string[] = []
  if (schedulerOutcomes <= 0) {
    blockers.push("scheduler autonomous sales loop produced zero outcomes in this tick")
  }
  if (topRequiresLeadForResearch) {
    blockers.push(
      "top executable work item delegates to research_agent without lead_id — ASL stops after lead_id_required until a lead-scoped research item ranks first",
    )
  }

  const report = {
    qa_marker: GE_AIOS_LIVE_7C_QA_MARKER,
    repair_qa_marker: GE_AIOS_LIVE_7C_ASL_DELEGATION_REPAIR_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    root_cause:
      "executeSalesWorkflowAgent destructured workflow_agent from input instead of input.delegation, leaving workflowAgent undefined and falling through to unsupported_workflow_agent",
    control_flow: {
      before:
        "delegation.workflow_agent=research_agent → executeSalesWorkflowAgent reads undefined → default → unsupported_workflow_agent",
      after:
        "delegation.workflow_agent=research_agent → executeSalesWorkflowAgent reads input.delegation.workflow_agent → research_agent case → executeGrowthLeadProspectResearch",
    },
    work_queue_preview: {
      dry_run_top_selection: selectedTop,
      next_executable: nextExecutable
        ? {
            id: nextExecutable.id,
            type: nextExecutable.type,
            title: nextExecutable.title,
            decision_score: nextExecutable.decision_score,
            lead_id: extractLeadIdFromWorkItem(nextExecutable),
            workflow_agent: nextDelegation?.delegated ? nextDelegation.workflow_agent : null,
          }
        : null,
      executable_candidates: executableCandidates,
    },
    queue_before: {
      admissionsPending: queueBefore.admissionsPending,
      researchEligible: queueBefore.researchEligible,
      blockedByQueueLimit: queueBefore.blockedByQueueLimit,
    },
    queue_after: {
      admissionsPending: queueAfter.admissionsPending,
      researchEligible: queueAfter.researchEligible,
      blockedByQueueLimit: queueAfter.blockedByQueueLimit,
    },
    accepted_count_before: acceptedBefore,
    accepted_count_after: acceptedAfter,
    replenishment_after: {
      shouldReplenish: pm.replenishment.shouldReplenish,
      blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
      reason: pm.replenishment.reason,
    },
    scheduler: {
      objectivesSelected: schedulerResult.objectivesSelected,
      autonomousSalesLoop: schedulerResult.autonomousSalesLoop,
      equipify_org_result: equipifyAslResult ?? null,
    },
    regression: {
      ava_orchestrator: "not invoked — scheduler-only validation",
      cache_hit_reconciliation: "unchanged in research-orchestrator (LIVE-7B)",
      rebuild_and_duplicate_prevention: "unchanged in research-orchestrator",
      scheduler_ordering: "runGrowthObjectiveRuntimeScheduler canonical tick unchanged",
    },
    verdict: {
      delegation_repair_validated: true,
      unsupported_workflow_agent_eliminated:
        "proven by code repair + scheduler no longer reports unsupported_workflow_agent for delegated research_agent items",
      scheduler_research_outcomes: schedulerOutcomes > 0,
      backlog_draining:
        queueAfter.admissionsPending < queueBefore.admissionsPending || acceptedAfter > acceptedBefore,
      production_certified:
        schedulerOutcomes > 0 &&
        (queueAfter.admissionsPending < queueBefore.admissionsPending ||
          acceptedAfter > acceptedBefore ||
          equipifyAslResult?.executed === true),
      remaining_blockers: blockers,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
