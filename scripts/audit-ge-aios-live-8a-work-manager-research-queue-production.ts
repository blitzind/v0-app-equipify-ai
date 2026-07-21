/**
 * GE-AIOS-LIVE-8A — Work Manager research queue certification (read-only production).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-ge-aios-live-8a-work-manager-research-queue-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import {
  evaluateGrowthPortfolioLeadEligibility,
  buildPortfolioEligibilityContext,
} from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { delegateWorkItem, resolveWorkflowAgentForWorkItem } from "@/lib/growth/specialists/execution/sales-specialist-execution-bridge"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { buildDecisionContext, flattenDecisionCandidates } from "@/lib/growth/decision-engine/context/build-decision-context"
import { rankNextActions } from "@/lib/growth/decision-engine/ranking/rank-next-actions"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"

export const GE_AIOS_LIVE_8A_QA_MARKER = "ge-aios-live-8a-work-manager-research-queue-cert-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID

function groupWorkItems(items: ReturnType<typeof runWorkManager>["all_work_items"]) {
  const groups: Record<string, typeof items> = {
    mission: [],
    research: [],
    qualification: [],
    outreach: [],
    meeting: [],
    approval: [],
    reply: [],
    business_understanding: [],
    wait: [],
    other: [],
  }
  for (const item of items) {
    const bucket = groups[item.type] ? item.type : "other"
    groups[bucket].push(item)
  }
  return groups
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")

  const admin = boot.admin
  const generatedAt = new Date().toISOString()

  const [snapshot, queueDiag] = await Promise.all([
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: ORG_ID,
      generatedAt,
    }),
    diagnoseAdmissionQueue(admin, ORG_ID),
  ])

  if (!snapshot) throw new Error("portfolio_snapshot_unavailable")

  const portfolioEligibility = buildPortfolioEligibilityContext(ORG_ID, snapshot.portfolioLeads)
  const researchEligibleLeads = snapshot.portfolioLeads.filter((lead) => {
    const admission = resolveLeadAdmissionStateFromMetadata(lead.metadata)
    return (
      admission === "review" &&
      shouldAutoQueueLeadResearch({
        website: lead.website,
        status: lead.status,
        metadata: lead.metadata,
        lastProspectResearchedAt: lead.lastProspectResearchedAt,
        latestProspectResearchRunId: lead.latestProspectResearchRunId,
        lastResearchedAt: lead.lastResearchedAt,
        latestResearchRunId: lead.latestResearchRunId,
      })
    )
  })

  const traceLead = researchEligibleLeads[0] ?? null
  const traceEligibility = traceLead
    ? evaluateGrowthPortfolioLeadEligibility({ lead: traceLead, organizationId: ORG_ID })
    : null

  const revenueSections = buildRevenueQueueDashboardSectionsFromLeads(snapshot.portfolioLeads, "priority")
  const needsReviewCount = revenueSections.find((s) => s.id === "needs_review")?.items.length ?? 0
  const highPriorityCount = revenueSections.find((s) => s.id === "high_priority")?.items.length ?? 0

  const { summary: memorySummary } = runMemoryEngine({
    organizationId: ORG_ID,
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

  const workResult = runWorkManager({
    ...snapshot.workManagerInput,
    memorySummary,
    organizationId: ORG_ID,
    portfolioLeads: snapshot.portfolioLeads,
  })

  const decisionContext = buildDecisionContext({
    workspaceSummary: snapshot.workManagerInput.workspaceSummary,
    waitingOnYou: snapshot.workManagerInput.waitingOnYou,
    dailyWorkQueue: snapshot.workManagerInput.dailyWorkQueue,
    accomplishments: snapshot.workManagerInput.accomplishments,
    timeline: snapshot.workManagerInput.timeline,
    memorySummary,
    leadSnapshotsById: snapshot.workManagerInput.leadSnapshotsById,
    portfolioEligibility,
  })
  const candidates = flattenDecisionCandidates(decisionContext)
  const ranked = rankNextActions(candidates, decisionContext)

  const allItems = workResult.all_work_items
  const executable = allItems.filter(isExecutableWorkItem)
  const groupedAll = groupWorkItems(allItems)
  const groupedExecutable = groupWorkItems(executable)

  const nextExecutable = selectNextExecutableWorkItem(workResult)
  const nextDelegation = nextExecutable ? delegateWorkItem(nextExecutable) : null

  const researchWorkItems = allItems.filter((item) => item.type === "research")
  const scaleItem = allItems.find((item) => item.id === "work:scale:lead_pool") ?? null

  const report = {
    qa_marker: GE_AIOS_LIVE_8A_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    audit_1_scale_lead_pool: {
      generator: "buildScaleAwarenessCandidates",
      file: "lib/growth/decision-engine/context/build-decision-context.ts",
      owner: "Decision Engine context builder (GE-AIOS-10B)",
      purpose: "Surface pagination awareness when leadPool.has_more — not executable research",
      intended_workflow_agent: "none / mission planning (not lead research)",
      actual_workflow_agent_via_delegation: scaleItem
        ? resolveWorkflowAgentForWorkItem(scaleItem)
        : null,
      production: scaleItem
        ? {
            id: scaleItem.id,
            type: scaleItem.type,
            decision_score: scaleItem.decision_score,
            can_execute_autonomously: scaleItem.can_execute_autonomously,
            lead_id: extractLeadIdFromWorkItem(scaleItem),
          }
        : null,
      trigger: snapshot.workManagerInput.workspaceSummary.leadPool?.has_more ?? false,
    },
    audit_2_lead_research_work_items: {
      generators: [
        {
          path: "buildDailyWorkQueueResearchCandidates → buildLeadDiscoveryCandidates(begin_research)",
          requires: "dailyWorkQueue item with /research/ actionLabel + lead href",
        },
        {
          path: "candidateFromQueueItem(inferActionKind research)",
          requires: "dailyWorkQueue item from IRE daily revenue queue",
        },
        {
          path: "buildResearchCandidates(researchLoopSummary)",
          requires: "completed Ava loop follow-ons only (outreach/qualification), not pending research",
        },
      ],
      production_research_type_work_items: researchWorkItems.length,
      production_research_company_candidates: candidates.filter((c) => c.kind === "research_company").length,
      note: "No dedicated generator projects admission_review + researchEligible backlog into decision candidates",
    },
    audit_3_queue_composition: {
      admissions_pending: queueDiag.admissionsPending,
      research_eligible_count: researchEligibleLeads.length,
      portfolio_eligible_count: portfolioEligibility.eligibleCount,
      daily_work_queue_items: snapshot.workManagerInput.dailyWorkQueue.length,
      revenue_queue_needs_review_cards: needsReviewCount,
      revenue_queue_high_priority_cards: highPriorityCount,
      all_work_items_total: allItems.length,
      executable_total: executable.length,
      grouped_all: Object.fromEntries(
        Object.entries(groupedAll).map(([key, items]) => [key, items.length]),
      ),
      grouped_executable: Object.fromEntries(
        Object.entries(groupedExecutable).map(([key, items]) => [
          key,
          items.map((item) => ({
            id: item.id,
            title: item.title,
            type: item.type,
            decision_score: item.decision_score,
            lead_id: extractLeadIdFromWorkItem(item),
            workflow_agent: resolveWorkflowAgentForWorkItem(item),
          })),
        ]),
      ),
      top_ranked_candidates: ranked.slice(0, 8).map((row) => ({
        id: row.id,
        kind: row.kind,
        overall_score: row.overall_score,
        href: row.href,
        requires_operator: row.requires_operator,
        blocked_by: row.blocked_by,
      })),
    },
    audit_4_workflow_agent_mapping: {
      authority: "resolveWorkflowAgentForWorkItem in sales-specialist-execution-bridge.ts",
      mapping: {
        research: "research_agent",
        qualification: "qualification_agent",
        outreach: "outreach_agent",
        meeting: "meeting_agent",
        mission: "defaults to research_agent (WORKFLOW_AGENT_BY_WORK_TYPE miss)",
      },
      scale_lead_pool_delegation: scaleItem
        ? {
            type: scaleItem.type,
            resolved_agent: resolveWorkflowAgentForWorkItem(scaleItem),
            intentional: false,
          }
        : null,
    },
    audit_5_candidate_projection_trace: traceLead
      ? {
          leadId: traceLead.id,
          company: traceLead.companyName,
          admission: resolveLeadAdmissionStateFromMetadata(traceLead.metadata),
          admission_reasons: traceLead.metadata?.admission_reasons ?? [],
          shouldAutoQueueLeadResearch: shouldAutoQueueLeadResearch({
            website: traceLead.website,
            status: traceLead.status,
            metadata: traceLead.metadata,
            lastProspectResearchedAt: traceLead.lastProspectResearchedAt,
            latestProspectResearchRunId: traceLead.latestProspectResearchRunId,
            lastResearchedAt: traceLead.lastResearchedAt,
            latestResearchRunId: traceLead.latestResearchRunId,
          }),
          portfolio_eligibility: traceEligibility,
          in_daily_work_queue: snapshot.workManagerInput.dailyWorkQueue.some((item) =>
            item.href?.includes(traceLead.id),
          ),
          in_revenue_queue_needs_review: revenueSections
            .find((s) => s.id === "needs_review")
            ?.items.some((card) => card.id === traceLead.id),
          projected_as_decision_candidate: candidates.some(
            (c) => c.href?.includes(traceLead.id) || c.id.includes(traceLead.id),
          ),
          projected_as_work_item: allItems.some(
            (item) => extractLeadIdFromWorkItem(item) === traceLead.id,
          ),
          blocking_reason:
            traceEligibility?.reasonCode === "admission_review"
              ? "Portfolio eligibility excludes admission_review leads before Work Manager ranking"
              : traceEligibility?.reasonCode ?? "unknown",
        }
      : null,
    audit_6_queue_lifecycle: {
      chain: [
        "Lead intake → admission review + pending_operational_keyword_validation",
        "shouldAutoQueueLeadResearch=true (review allowed when website present)",
        "evaluateGrowthPortfolioLeadEligibility → eligible:false reason admission_review",
        "Excluded from eligibleLeads → daily revenue work queue → decision candidates",
        "Revenue queue cards exist but are NOT fed into decision engine for pending research",
        "Only scale:lead_pool (+ optional mission:pipeline) remain executable",
        "ASL selects scale item → research_agent → lead_id_required",
      ],
      missing_transition: "admission_review research backlog → decision candidate / work item projection",
    },
    audit_7_recommendation: {
      root_cause_category: "Queue filtering defect",
      root_cause:
        "Portfolio eligibility (growth-portfolio-eligibility-1a.ts) excludes all admission_review leads from Work Manager inputs, while the ~33 research-eligible backlog is entirely in review pending post-research keyword validation.",
      evidence: [
        `${researchEligibleLeads.length} leads pass shouldAutoQueueLeadResearch in review state`,
        `portfolioEligibility.eligibleCount=${portfolioEligibility.eligibleCount} (review leads excluded)`,
        `dailyWorkQueue.length=${snapshot.workManagerInput.dailyWorkQueue.length}`,
        `executable research work items=${groupedExecutable.research?.length ?? 0}`,
        `only executable item=${nextExecutable?.id ?? null}`,
      ],
      smallest_engineering_repair:
        "Project admission_review + shouldAutoQueueLeadResearch leads into decision-engine research_company candidates (or exempt that subset from admission_review portfolio exclusion for work-item generation only), mirroring Ava orchestrator Revenue Queue selection — without changing scheduler, research execution, or admissions authority.",
      secondary_note:
        "Map mission-type work items to a non-research workflow agent (or skip when lead_id absent) — separate from primary backlog projection gap.",
      work_manager_production_certified: false,
    },
    next_executable: nextExecutable
      ? {
          id: nextExecutable.id,
          type: nextExecutable.type,
          workflow_agent: nextDelegation?.delegated ? nextDelegation.workflow_agent : null,
          skip_reason: nextDelegation?.delegated ? null : nextDelegation?.reason,
          lead_id: extractLeadIdFromWorkItem(nextExecutable),
        }
      : null,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
