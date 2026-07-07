/** GE-AVA-AUTONOMY-COMPLETION-RUN-1 — Async post-import completion orchestrator (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { runAutonomousOutreachPreparationManualRequest } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import type { GrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { resolveLeadCommunicationStrategyBundle } from "@/lib/growth/contact-verification/lead-communication-strategy-resolver"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_AVA_AUTONOMY_COMPLETION_METADATA_KEY,
  GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
  GROWTH_AVA_AUTONOMY_COMPLETION_FEATURE_FLAG,
  type GrowthAvaAutonomyCompletionHumanApprovalSnapshot,
  type GrowthAvaAutonomyCompletionLeadMetadata,
  type GrowthAvaAutonomyCompletionLeadSummary,
  type GrowthMissionRuntimeAvaAutonomyCompletionState,
} from "@/lib/growth/mission-center/growth-ava-autonomy-completion-types"
import {
  appendEvent,
  type GrowthObjectiveMissionRuntimeState,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { getGrowthObjective, updateGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import { buildOpportunityIntelligenceViewModel } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-aggregator"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runUnifiedRevenueWorkflowLifecycleReEvaluation } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"

export function isAvaAutonomyCompletionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[GROWTH_AVA_AUTONOMY_COMPLETION_FEATURE_FLAG]?.trim() === "true"
}

function readLeadCompletionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthAvaAutonomyCompletionLeadMetadata | null {
  const raw = metadata?.[GROWTH_AVA_AUTONOMY_COMPLETION_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  if (record.qa_marker !== GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER) return null
  if (typeof record.acquisitionMissionId !== "string") return null
  if (typeof record.status !== "string") return null
  if (typeof record.registeredAt !== "string") return null
  return record as GrowthAvaAutonomyCompletionLeadMetadata
}

async function writeLeadCompletionMetadata(
  admin: SupabaseClient,
  leadId: string,
  metadata: GrowthAvaAutonomyCompletionLeadMetadata,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return
  await admin
    .schema("growth")
    .from("leads")
    .update({
      metadata: {
        ...(lead.metadata ?? {}),
        [GROWTH_AVA_AUTONOMY_COMPLETION_METADATA_KEY]: metadata,
      },
    })
    .eq("id", leadId)
}

function defaultCompletionState(): GrowthMissionRuntimeAvaAutonomyCompletionState {
  return {
    qa_marker: GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
    pendingLeadIds: [],
    completedLeadIds: [],
    completions: {},
    humanApprovalCenter: null,
    lastCompletionAt: null,
    stoppedAt: "human_approval",
  }
}

function resolveCompletionState(
  runtime: GrowthObjectiveMissionRuntimeState,
): GrowthMissionRuntimeAvaAutonomyCompletionState {
  const existing = runtime.avaAutonomyCompletion
  if (existing?.qa_marker === GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER) return existing
  return defaultCompletionState()
}

async function persistMissionCompletionState(
  admin: SupabaseClient,
  organizationId: string,
  missionId: string,
  patch: (input: {
    runtime: GrowthObjectiveMissionRuntimeState
    completion: GrowthMissionRuntimeAvaAutonomyCompletionState
  }) => {
    runtime: GrowthObjectiveMissionRuntimeState
    completion: GrowthMissionRuntimeAvaAutonomyCompletionState
  },
): Promise<void> {
  const objective = await getGrowthObjective(admin, organizationId, missionId)
  if (!objective) return

  const runtime = objective.executionContext?.missionRuntime ?? {
    qa_marker: "ge-ava-mission-runtime-1a-v1" as const,
    approved: false,
    approvedAt: null,
    lifecycleState: "researching" as const,
    activityLabel: "Ava is researching imported leads.",
    lastOrchestrationAt: null,
    counters: {
      newCompaniesFound: 0,
      recordsImported: 0,
      researchingCount: 0,
      draftsPrepared: 0,
      pendingApprovals: 0,
    },
    audience: null,
    datamoon: null,
    events: [],
  }

  const completion = resolveCompletionState(runtime)
  const next = patch({ runtime, completion })
  const context = objective.executionContext ?? {
    qa_marker: "growth-objective-ge-auto-2g-v1" as const,
    version: 1 as const,
    stages: {},
    recoveredAt: null,
  }

  await updateGrowthObjective(admin, organizationId, missionId, {
    executionContext: {
      ...context,
      missionRuntime: {
        ...next.runtime,
        avaAutonomyCompletion: next.completion,
        lastOrchestrationAt: new Date().toISOString(),
      },
    },
  })
}

function buildHumanApprovalSnapshot(
  importedLeadIds: string[],
  commandCenter: Awaited<ReturnType<typeof fetchAiOsCommandCenterReadModel>>,
): GrowthAvaAutonomyCompletionHumanApprovalSnapshot {
  const importedSet = new Set(importedLeadIds)
  const pendingItems = commandCenter.humanApprovalCenter.items.filter(
    (item) =>
      item.status === "pending" || item.status === "needs_review" || item.status === "blocked",
  )
  const relatedItems = pendingItems.filter(
    (item) =>
      item.subjectType === "lead" &&
      typeof item.subjectId === "string" &&
      importedSet.has(item.subjectId),
  )

  return {
    totalPending: pendingItems.length,
    relatedPending: relatedItems.length,
    approvalsHref: "/growth/os/approvals",
    topItems: (relatedItems.length > 0 ? relatedItems : pendingItems).slice(0, 10).map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel ?? "general",
      href: item.route ?? null,
      leadId: item.subjectType === "lead" ? (item.subjectId ?? null) : null,
    })),
  }
}

function shouldPrepareOutreachPackage(snapshot: GrowthLeadResearchWorkflowSnapshot): boolean {
  if (snapshot.workflowStatus !== "assessed") return false
  if (snapshot.nextBestAction?.kind === "generate_outreach_draft") return true
  if (snapshot.opportunityAssessment?.recommendation === "prepare_outreach") return true
  const workflowType = snapshot.executionPlan?.workflowType
  if (workflowType === "email_outreach" || workflowType === "multi_channel_outreach") return true
  return false
}

function resolveBuyingCommitteeSignal(
  decisionMakerStatus: string | null | undefined,
  qualificationCoverage: number | null | undefined,
): string | null {
  if (decisionMakerStatus === "present") return "decision_makers_present"
  if (decisionMakerStatus === "partial") return "partial_committee"
  if (typeof qualificationCoverage === "number" && qualificationCoverage >= 40) {
    return `committee_coverage_${qualificationCoverage}`
  }
  return decisionMakerStatus ?? null
}

export async function registerAvaAutonomyCompletionPendingLeads(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    leadIds: string[]
  },
): Promise<void> {
  if (!isAvaAutonomyCompletionEnabled()) return

  const uniqueLeadIds = [...new Set(input.leadIds.filter(Boolean))]
  if (uniqueLeadIds.length === 0) return

  const registeredAt = new Date().toISOString()
  for (const leadId of uniqueLeadIds) {
    await writeLeadCompletionMetadata(admin, leadId, {
      qa_marker: GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
      acquisitionMissionId: input.missionId,
      status: "pending",
      registeredAt,
    })
  }

  await persistMissionCompletionState(admin, input.organizationId, input.missionId, ({ runtime, completion }) => {
    const pendingLeadIds = [...new Set([...completion.pendingLeadIds, ...uniqueLeadIds])]
    const nextRuntime = appendEvent(
      {
        ...runtime,
        lifecycleState: "researching",
        counters: {
          ...runtime.counters,
          researchingCount: Math.max(runtime.counters.researchingCount, pendingLeadIds.length),
        },
      },
      `Registered ${uniqueLeadIds.length} lead(s) for Ava autonomy completion.`,
      "researching",
    )
    return {
      runtime: nextRuntime,
      completion: {
        ...completion,
        pendingLeadIds,
      },
    }
  })

  logGrowthEngine("ava_autonomy_completion_registered", {
    qa_marker: GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
    mission_id: input.missionId,
    lead_count: uniqueLeadIds.length,
  })
}

export function scheduleAvaAutonomyCompletionForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): void {
  if (!isAvaAutonomyCompletionEnabled()) return

  void runAvaAutonomyCompletionForLead(admin, input).catch((error) => {
    const detail = error instanceof Error ? error.message : String(error)
    logGrowthEngine("ava_autonomy_completion_async_failed", {
      qa_marker: GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
      lead_id: input.leadId,
      detail: detail.slice(0, 500),
    })
  })
}

export async function runAvaAutonomyCompletionForLead(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<GrowthAvaAutonomyCompletionLeadSummary> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return {
      leadId: input.leadId,
      status: "skipped",
      workflowStatus: null,
      opportunityIntelligenceReady: false,
      communicationStrategyReady: false,
      buyingCommitteeSignal: null,
      outreachPackagePrepared: false,
      completedAt: new Date().toISOString(),
    }
  }

  const marker = readLeadCompletionMetadata(lead.metadata)
  if (!marker || marker.status === "completed" || marker.status === "skipped") {
    return {
      leadId: input.leadId,
      status: "skipped",
      workflowStatus: null,
      opportunityIntelligenceReady: false,
      communicationStrategyReady: false,
      buyingCommitteeSignal: null,
      outreachPackagePrepared: false,
      completedAt: new Date().toISOString(),
    }
  }

  if (marker.status === "in_progress") {
    return {
      leadId: input.leadId,
      status: "in_progress",
      workflowStatus: null,
      opportunityIntelligenceReady: false,
      communicationStrategyReady: false,
      buyingCommitteeSignal: null,
      outreachPackagePrepared: false,
      completedAt: null,
    }
  }

  const startedAt = new Date().toISOString()
  await writeLeadCompletionMetadata(admin, input.leadId, {
    ...marker,
    status: "in_progress",
    startedAt,
  })

  const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  if (!snapshot || snapshot.workflowStatus !== "assessed") {
    const failedSummary: GrowthAvaAutonomyCompletionLeadSummary = {
      leadId: input.leadId,
      status: "failed",
      workflowStatus: snapshot?.workflowStatus ?? null,
      opportunityIntelligenceReady: false,
      communicationStrategyReady: false,
      buyingCommitteeSignal: null,
      outreachPackagePrepared: false,
      completedAt: new Date().toISOString(),
    }
    await writeLeadCompletionMetadata(admin, input.leadId, {
      ...marker,
      status: "failed",
      startedAt,
      completedAt: failedSummary.completedAt,
      skipReason: "research_not_assessed",
    })
    return failedSummary
  }

  await runUnifiedRevenueWorkflowLifecycleReEvaluation({
    admin,
    leadId: input.leadId,
    organizationId: input.organizationId,
    events: ["decision_maker_discovered", "qualification_updated"],
  }).catch(() => undefined)

  const refreshedLead = (await fetchGrowthLeadById(admin, input.leadId)) ?? lead

  const opportunityIntelligence = await buildOpportunityIntelligenceViewModel({
    admin,
    leadId: input.leadId,
    organizationId: input.organizationId,
  }).catch(() => null)

  const communicationStrategy = await resolveLeadCommunicationStrategyBundle(refreshedLead, {
    organizationId: input.organizationId,
    admin,
  }).catch(() => ({ enabled: false, bundle: null }))

  let outreachPackagePrepared = false
  let outreachSkipReason: string | null = null
  if (shouldPrepareOutreachPackage(snapshot)) {
    try {
      const outreach = await runAutonomousOutreachPreparationManualRequest(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
      })
      const latestPackage = outreach.recentRuns.find(
        (run) =>
          run.leadId === input.leadId &&
          run.outcome === "completed" &&
          run.approvalPackage?.pendingHumanApproval,
      )
      outreachPackagePrepared = Boolean(latestPackage?.approvalPackage)
      if (!outreachPackagePrepared) {
        outreachSkipReason = "outreach_package_not_created"
      }
    } catch (error) {
      outreachSkipReason = error instanceof Error ? error.message : "outreach_preparation_failed"
    }
  } else {
    outreachSkipReason = "execution_plan_does_not_recommend_outreach"
  }

  const commandCenter = await fetchAiOsCommandCenterReadModel(admin, {
    organizationId: input.organizationId,
  })
  const humanApprovalCenter = buildHumanApprovalSnapshot([input.leadId], commandCenter)

  const completedAt = new Date().toISOString()
  const summary: GrowthAvaAutonomyCompletionLeadSummary = {
    leadId: input.leadId,
    status: "completed",
    workflowStatus: snapshot.workflowStatus,
    opportunityIntelligenceReady: Boolean(opportunityIntelligence),
    communicationStrategyReady: Boolean(communicationStrategy.bundle?.communication_strategy),
    buyingCommitteeSignal: resolveBuyingCommitteeSignal(
      refreshedLead.decisionMakerStatus,
      snapshot.qualification?.fitScore ?? null,
    ),
    outreachPackagePrepared,
    outreachSkipReason,
    completedAt,
  }

  await writeLeadCompletionMetadata(admin, input.leadId, {
    ...marker,
    status: "completed",
    startedAt,
    completedAt,
  })

  await persistMissionCompletionState(
    admin,
    input.organizationId,
    marker.acquisitionMissionId,
    ({ runtime, completion }) => {
      const pendingLeadIds = completion.pendingLeadIds.filter((id) => id !== input.leadId)
      const completedLeadIds = [...new Set([...completion.completedLeadIds, input.leadId])]
      const allComplete = pendingLeadIds.length === 0

      const nextRuntime = appendEvent(
        {
          ...runtime,
          lifecycleState: allComplete ? "waiting_for_approval" : "preparing_recommendations",
          activityLabel: allComplete
            ? "Ava prepared recommendations — waiting for human approval."
            : "Ava is preparing recommendations for imported leads.",
          counters: {
            ...runtime.counters,
            researchingCount: pendingLeadIds.length,
            draftsPrepared:
              completedLeadIds.filter((id) => completion.completions[id]?.outreachPackagePrepared)
                .length + (summary.outreachPackagePrepared ? 1 : 0),
            pendingApprovals: humanApprovalCenter.relatedPending || humanApprovalCenter.totalPending,
          },
        },
        allComplete
          ? `Ava autonomy completion finished for ${completedLeadIds.length} lead(s).`
          : `Ava autonomy completion finished for lead ${input.leadId.slice(0, 8)}…`,
        allComplete ? "waiting_for_approval" : "preparing_recommendations",
      )

      return {
        runtime: nextRuntime,
        completion: {
          ...completion,
          pendingLeadIds,
          completedLeadIds,
          completions: {
            ...completion.completions,
            [input.leadId]: summary,
          },
          humanApprovalCenter,
          lastCompletionAt: completedAt,
        },
      }
    },
  )

  logGrowthEngine("ava_autonomy_completion_completed", {
    qa_marker: GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER,
    lead_id: input.leadId,
    mission_id: marker.acquisitionMissionId,
    outreach_prepared: outreachPackagePrepared,
    hac_related_pending: humanApprovalCenter.relatedPending,
  })

  return summary
}

export async function fetchAvaAutonomyCompletionMissionState(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string },
): Promise<GrowthMissionRuntimeAvaAutonomyCompletionState | null> {
  const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
  const runtime = objective?.executionContext?.missionRuntime
  if (!runtime) return null
  return resolveCompletionState(runtime)
}
