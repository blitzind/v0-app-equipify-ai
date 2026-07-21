/**
 * GE-AIOS-LIVE-8B — Work Manager review research projection production validation.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-ge-aios-live-8b-work-manager-research-projection-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildPortfolioEligibilityContext } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER } from "@/lib/growth/research/growth-revenue-queue-research-selection"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { delegateWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"

export const GE_AIOS_LIVE_8B_QA_MARKER = "ge-aios-live-8b-work-manager-research-projection-cert-v1" as const

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
  const portfolioEligibility = workSnapshot
    ? buildPortfolioEligibilityContext(ORG_ID, workSnapshot.portfolioLeads)
    : null

  const researchEligibleReviewCount = (workSnapshot?.portfolioLeads ?? []).filter((lead) => {
    return (
      resolveLeadAdmissionStateFromMetadata(lead.metadata) === "review" &&
      shouldAutoQueueLeadResearch(lead)
    )
  }).length

  const allItems = workPreview?.all_work_items ?? []
  const executableItems = allItems.filter(isExecutableWorkItem)
  const researchWorkItems = allItems.filter((item) => item.type === "research")
  const executableResearch = executableItems.filter((item) => item.type === "research")

  const leadIdsInResearchWork = new Set<string>()
  let duplicateResearchWorkItems = 0
  for (const item of researchWorkItems) {
    const leadId = extractLeadIdFromWorkItem(item)
    if (!leadId) continue
    if (leadIdsInResearchWork.has(leadId)) duplicateResearchWorkItems += 1
    leadIdsInResearchWork.add(leadId)
  }

  const nextExecutable = workPreview != null ? selectNextExecutableWorkItem(workPreview) : null
  const nextDelegation = nextExecutable ? delegateWorkItem(nextExecutable) : null
  const nextLeadId = nextExecutable ? extractLeadIdFromWorkItem(nextExecutable) : null

  const executableCandidates = executableItems
    .sort((left, right) => {
      if (right.decision_score !== left.decision_score) {
        return right.decision_score - left.decision_score
      }
      return right.priority - left.priority
    })
    .slice(0, 8)
    .map((item) => ({
      work_item_id: item.id,
      type: item.type,
      title: item.title,
      decision_score: item.decision_score,
      lead_id: extractLeadIdFromWorkItem(item),
      workflow_agent: delegateWorkItem(item).delegated ? delegateWorkItem(item).workflow_agent : null,
    }))

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
  const iterationLog = equipifyAslResult?.iteration_log ?? []
  const researchIterations = iterationLog.filter(
    (row) => row.workflow_agent === "research_agent" && row.lead_id,
  )
  const leadIdRequiredIterations = iterationLog.filter((row) =>
    /lead_id_required/i.test(row.skip_reason ?? row.error ?? ""),
  )

  const scaleOnlyExecutable =
    executableItems.length === 1 && executableItems[0]?.id === "work:scale:lead_pool"

  const blockers: string[] = []
  if (researchWorkItems.length <= 0) blockers.push("no research-type work items projected")
  if (executableResearch.length <= 0) blockers.push("no executable lead-scoped research work items")
  if (scaleOnlyExecutable) blockers.push("work:scale:lead_pool remains the only executable item")
  if (!nextExecutable || nextExecutable.type !== "research" || !nextLeadId) {
    blockers.push("ASL would not select a lead-scoped research work item first")
  }
  if (nextDelegation?.delegated && nextDelegation.workflow_agent === "research_agent" && !nextLeadId) {
    blockers.push("top research delegation still missing lead_id")
  }
  if (duplicateResearchWorkItems > 0) blockers.push("duplicate research work items for same lead")
  if (schedulerOutcomes <= 0) blockers.push("scheduler produced zero ASL outcomes in this tick")
  if (researchIterations.length <= 0) {
    blockers.push("scheduler tick did not execute research_agent with lead_id")
  }
  if (leadIdRequiredIterations.length > 0) {
    blockers.push("scheduler still reports lead_id_required iterations")
  }

  const report = {
    qa_marker: GE_AIOS_LIVE_8B_QA_MARKER,
    repair_qa_marker: GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    repair_summary:
      "Project admission_review + shouldAutoQueueLeadResearch leads into decision-engine research_company candidates using shared revenue queue section ordering; allow research work items through portfolio eligibility via reviewResearchProjectionLeadIds.",
    projection: {
      research_eligible_review_count: researchEligibleReviewCount,
      review_research_projection_count: portfolioEligibility?.reviewResearchProjectionCount ?? 0,
      portfolio_eligible_count: portfolioEligibility?.eligibleCount ?? 0,
      research_work_items_total: researchWorkItems.length,
      executable_research_total: executableResearch.length,
      duplicate_research_work_items: duplicateResearchWorkItems,
      scale_only_executable: scaleOnlyExecutable,
    },
    work_queue_preview: {
      dry_run_top_selection: dryRunInspect.selected_work?.[0] ?? null,
      next_executable: nextExecutable
        ? {
            id: nextExecutable.id,
            type: nextExecutable.type,
            title: nextExecutable.title,
            decision_score: nextExecutable.decision_score,
            lead_id: nextLeadId,
            workflow_agent: nextDelegation?.delegated ? nextDelegation.workflow_agent : null,
          }
        : null,
      executable_candidates: executableCandidates,
    },
    queue_before: {
      admissionsPending: queueBefore.admissionsPending,
      researchEligible: queueBefore.researchEligible,
    },
    queue_after: {
      admissionsPending: queueAfter.admissionsPending,
      researchEligible: queueAfter.researchEligible,
    },
    accepted_count_before: acceptedBefore,
    accepted_count_after: acceptedAfter,
    replenishment_after: {
      shouldReplenish: pm.replenishment.shouldReplenish,
      blockedByQueueLimit: pm.replenishment.blockedByQueueLimit,
    },
    scheduler: {
      objectivesSelected: schedulerResult.objectivesSelected,
      total_outcomes_completed: schedulerOutcomes,
      equipify_org_result: equipifyAslResult ?? null,
      research_iterations: researchIterations,
      lead_id_required_iterations: leadIdRequiredIterations,
    },
    regression: {
      ava_orchestrator: "not invoked — scheduler-only validation",
      portfolio_eligible_lead_semantics: "eligibleLeadIds unchanged; review projection uses separate allowlist",
      cache_hit_reconciliation: "unchanged in research-orchestrator (LIVE-7B)",
    },
    verdict: {
      research_work_items_projected: researchWorkItems.length > 0,
      scale_no_longer_only_executable: !scaleOnlyExecutable,
      asl_selects_lead_scoped_research:
        nextExecutable?.type === "research" && Boolean(nextLeadId),
      scheduler_research_executed: researchIterations.length > 0,
      backlog_draining:
        queueAfter.admissionsPending < queueBefore.admissionsPending || acceptedAfter > acceptedBefore,
      no_duplicate_research_work_items: duplicateResearchWorkItems === 0,
      production_certified:
        researchWorkItems.length > 0 &&
        executableResearch.length > 0 &&
        !scaleOnlyExecutable &&
        nextExecutable?.type === "research" &&
        Boolean(nextLeadId) &&
        researchIterations.length > 0 &&
        duplicateResearchWorkItems === 0 &&
        leadIdRequiredIterations.length === 0,
      remaining_blockers: blockers,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
