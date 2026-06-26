/** GE-AIOS-3E — Executive Mission Planning Review (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listAiExecutiveBrainRuntimes,
  upsertAiExecutiveBrainRuntime,
} from "@/lib/growth/aios/ai-executive-brain-repository"
import { runExecutiveMissionPlanningTick } from "@/lib/growth/aios/ai-executive-mission-planning-service"
import {
  resolveExecutiveMissionPlanningStage,
  selectableExecutiveWorkOrderProposals,
} from "@/lib/growth/aios/ai-executive-mission-planning-planner"
import type {
  AiExecutiveMissionPlanningActiveWorkOrderSummary,
  AiExecutiveMissionPlanningMissionSummary,
  AiExecutiveMissionPlanningReviewApproveInput,
  AiExecutiveMissionPlanningReviewApproveResult,
  AiExecutiveMissionPlanningReviewPreviewInput,
  AiExecutiveMissionPlanningReviewPreviewResult,
  AiExecutiveMissionPlanningReviewReadModel,
} from "@/lib/growth/aios/ai-executive-mission-planning-review-types"
import { findExecutionRuntimeRecordForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-service"
import { buildDryRunEligibilityForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-service"
import { buildPilotEligibilityForPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-service"
import { buildAgentPlanContext } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import { buildRevenueOperatorPlanContext } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-service"
import { buildGrowthAgentEventPlanContext } from "@/lib/growth/aios/growth/growth-agent-event-service"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import {
  isAiWorkOrderActiveStatus,
  type AiWorkOrder,
} from "@/lib/growth/aios/ai-work-order-types"
import { getGrowthObjective } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import {
  GROWTH_AI_OS_MISSION_ID_INVALID_ERROR,
  resolveAiOsMissionIdParam,
} from "@/lib/growth/aios/ai-os-mission-route-params"
import { fetchAiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-service"
import { LEAD_RESEARCH_PILOT_MISSION_TITLE } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import {
  buildGrowthLeadResearchExecutionPlanId,
  resolveEffectiveExecutionPlanApprovalStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import { fetchLatestExecutionPlanReviewForLead } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import {
  buildGrowthLeadResearchExecutionPlanAuditTrail,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-service"
import {
  resolveApprovedPlanReadinessReason,
  resolveApprovedPlanReadinessState,
  resolveFutureExecutionSummary,
  summarizeExecutionPlanAuditTrail,
} from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import {
  buildFutureExecutionHandoffContract,
  summarizeFutureExecutionHandoffContract,
} from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import { resolveFutureExecutionHandoffInfrastructure } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-service"
import {
  auditWorkflowBoundary,
  buildPlanExecutionBoundaryStatus,
  summarizePlanBoundaryStatus,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  buildPlanPreflightChecklist,
  buildWorkflowPreflightChecklist,
  summarizePlanPreflightChecklist,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import {
  buildPlanExecutionSimulation,
  summarizePlanExecutionSimulation,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
import { buildAiOsPilotLeadResearchHref } from "@/lib/growth/aios/ai-os-public-routes"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary } from "@/lib/growth/aios/ai-executive-mission-planning-review-types"

const PLANNING_REVIEW_EXECUTIVE_INSTANCE_ID = "ge-aios-planning-review" as const

function assertResolvableAiOsMissionId(missionId: string): string {
  const resolved = resolveAiOsMissionIdParam(missionId)
  if (!resolved.ok) throw new Error(GROWTH_AI_OS_MISSION_ID_INVALID_ERROR)
  return resolved.missionId
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapMissionSummary(objective: GrowthObjective): AiExecutiveMissionPlanningMissionSummary {
  return {
    missionId: objective.id,
    title: objective.title,
    status: objective.status,
    objectiveType: objective.objectiveType,
    currentStageId: resolveExecutiveMissionPlanningStage(objective),
    running: objective.runtime?.running ?? false,
  }
}

function mapActiveWorkOrderSummary(workOrder: AiWorkOrder): AiExecutiveMissionPlanningActiveWorkOrderSummary {
  return {
    workOrderId: workOrder.id,
    workOrderType: workOrder.workOrderType,
    status: workOrder.status,
    assignedAgent: workOrder.assignedAgent,
    entityType: workOrder.entityType,
    entityId: workOrder.entityId,
    priority: workOrder.priority,
    issuedAt: workOrder.issuedAt,
  }
}

async function listActiveWorkOrdersForMission(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string },
): Promise<AiExecutiveMissionPlanningActiveWorkOrderSummary[]> {
  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
  })
  return workOrders.filter((row) => isAiWorkOrderActiveStatus(row.status)).map(mapActiveWorkOrderSummary)
}

async function listLeadResearchExecutionPlansForMission(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; objectiveTitle: string },
): Promise<AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary[]> {
  if (input.objectiveTitle !== LEAD_RESEARCH_PILOT_MISSION_TITLE) return []

  const workOrders = await listAiWorkOrders(admin, {
    organizationId: input.organizationId,
    missionId: input.missionId,
  })
  const leadIds = [
    ...new Set(
      workOrders
        .filter((row) => row.entityType === "lead" && row.entityId)
        .map((row) => row.entityId as string),
    ),
  ].slice(0, 5)

  const handoffInfrastructure = await resolveFutureExecutionHandoffInfrastructure(admin, {
    organizationId: input.organizationId,
  })

  const plans: AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary[] = []
  for (const leadId of leadIds) {
    const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: input.organizationId,
      leadId,
    })
    if (!snapshot?.executionPlan) continue
    const lead = await fetchGrowthLeadById(admin, leadId)
    const planId = buildGrowthLeadResearchExecutionPlanId({ leadId, plan: snapshot.executionPlan })
    const review = await fetchLatestExecutionPlanReviewForLead(admin, {
      organizationId: input.organizationId,
      leadId,
    })
    const approvalStatus = resolveEffectiveExecutionPlanApprovalStatus({
      plan: snapshot.executionPlan,
      review,
      planId,
    })
    const confidence =
      snapshot.opportunityAssessment?.confidence ?? snapshot.qualification?.confidence ?? null

    let readinessState = null
    let readinessReason = null
    let futureExecutionEligible = null
    let futureExecutionSummary = null
    let auditTrailSummary = null
    let handoffState = null
    let handoffSummary = null
    let boundaryClassification = null
    let boundarySummary = null
    let boundaryWarnings: string[] = []
    let preflightStatus = null
    let preflightSummary = null
    let preflightMissingRequirements: string[] = []
    let simulationStatus = null
    let simulationSummary = null
    let simulatedSuccessProbability = null
    let runtimeState = null
    let runtimeSummary = null
    let dryRunEligible = false
    let dryRunSummary = null
    let dryRunBlockedReasons: string[] = []
    let latestDryRunStatus = null
    let pilotEligible = false
    let pilotSummary = null
    let pilotBlockedReasons: string[] = []
    let pilotEnabled = false
    let runtimeEnabled = false
    let dryRunRequired = true
    let agentContext = null
    let orchestrationContext = null
    let agentEventContext = null

    if (approvalStatus === "approved_for_future_execution") {
      readinessState = resolveApprovedPlanReadinessState({
        plan: snapshot.executionPlan,
        approvalStatus,
        confidence,
      })
      readinessReason = resolveApprovedPlanReadinessReason(readinessState, {
        plan: snapshot.executionPlan,
        approvalStatus,
        confidence,
      })
      const futureExecution = resolveFutureExecutionSummary({
        plan: snapshot.executionPlan,
        readinessState,
      })
      futureExecutionEligible = futureExecution.eligible
      futureExecutionSummary = futureExecution.summary
      const auditTrail = await buildGrowthLeadResearchExecutionPlanAuditTrail(admin, {
        organizationId: input.organizationId,
        leadId,
        planId,
      })
      auditTrailSummary = summarizeExecutionPlanAuditTrail(auditTrail.entries)
      const handoffContract = buildFutureExecutionHandoffContract({
        planId,
        leadId,
        companyName: lead?.companyName ?? null,
        plan: snapshot.executionPlan,
        approvalState: approvalStatus,
        readinessState,
        readinessReason,
        futureExecutionEligible: futureExecution.eligible,
        evidenceSummary: snapshot.evidenceSummary,
        auditTrail,
        infrastructure: handoffInfrastructure,
        generatedAt: nowIso(),
        observationHref: buildAiOsPilotLeadResearchHref(leadId) ?? `/growth/os/pilot/lead-research/${leadId}`,
      })
      handoffState = handoffContract.handoffState
      handoffSummary = summarizeFutureExecutionHandoffContract(handoffContract)
      const workflowReport = auditWorkflowBoundary(
        snapshot.executionPlan.workflowType as GrowthLeadResearchCanonicalWorkflowType,
        handoffInfrastructure,
      )
      const planBoundary = buildPlanExecutionBoundaryStatus({ handoff: handoffContract, workflowReport })
      boundaryClassification = planBoundary.classification
      boundarySummary = summarizePlanBoundaryStatus(planBoundary)
      boundaryWarnings = planBoundary.boundaryWarnings
      const workflowPreflight = buildWorkflowPreflightChecklist({ boundary: workflowReport, infrastructure: handoffInfrastructure })
      const planPreflight = buildPlanPreflightChecklist({ handoff: handoffContract, workflowChecklist: workflowPreflight })
      preflightStatus = planPreflight.preflightStatus
      preflightSummary = summarizePlanPreflightChecklist(planPreflight)
      preflightMissingRequirements = planPreflight.missingRequirements
      const planSimulation = buildPlanExecutionSimulation({
        plan: snapshot.executionPlan,
        planId,
        leadId,
        companyName: lead?.companyName ?? null,
        approvalState: approvalStatus,
        readinessState,
        boundary: workflowReport,
        workflowPreflight,
        planPreflight,
        handoff: handoffContract,
        observationHref: buildAiOsPilotLeadResearchHref(leadId) ?? `/growth/os/pilot/lead-research/${leadId}`,
      })
      simulationStatus = planSimulation.simulatedExecutionStatus
      simulationSummary = summarizePlanExecutionSimulation(planSimulation)
      simulatedSuccessProbability = planSimulation.confidence
    }

    const runtimeRecord = await findExecutionRuntimeRecordForPlan(admin, {
      organizationId: input.organizationId,
      planId,
    })
    if (runtimeRecord) {
      runtimeState = runtimeRecord.state
      const completed = runtimeRecord.steps.filter((step) => step.status === "completed").length
      runtimeSummary = `${runtimeRecord.state.replaceAll("_", " ")} — ${completed}/${runtimeRecord.steps.length} steps`
    }

    const dryRunEligibility = await buildDryRunEligibilityForPlan(admin, {
      organizationId: input.organizationId,
      executionPlan: snapshot.executionPlan,
      approvalState: approvalStatus,
      confidence,
      planId,
    })
    dryRunEligible = dryRunEligibility.dryRunEligible
    dryRunSummary = dryRunEligibility.dryRunSummary
    dryRunBlockedReasons = dryRunEligibility.dryRunBlockedReasons
    latestDryRunStatus = dryRunEligibility.latestDryRunStatus

    const pilotEligibility = await buildPilotEligibilityForPlan(admin, {
      organizationId: input.organizationId,
      planId,
      executionPlan: snapshot.executionPlan,
      approvalState: approvalStatus,
      confidence,
    })
    pilotEligible = pilotEligibility.pilotEligible
    pilotSummary = pilotEligibility.pilotSummary
    pilotBlockedReasons = pilotEligibility.pilotBlockedReasons
    pilotEnabled = pilotEligibility.pilotEnabled
    runtimeEnabled = pilotEligibility.runtimeEnabled
    dryRunRequired = pilotEligibility.dryRunRequired

    agentContext = buildAgentPlanContext({
      workflowType: snapshot.executionPlan.workflowType,
      leadId,
      companyName: lead?.companyName ?? null,
    })

    const orchestration = await buildRevenueOperatorPlanContext(admin, {
      leadId,
      companyId: leadId,
      companyName: lead?.companyName ?? null,
      planId,
      workflowType: snapshot.executionPlan.workflowType,
      approvalStatus,
      readinessState,
      preflightStatus,
      pilotEligible,
      pilotBlockedReasons,
      runtimeState,
      latestDryRunStatus,
      confidence,
    })
    orchestrationContext = orchestration.planContext

    agentEventContext = await buildGrowthAgentEventPlanContext(admin, {
      leadId,
      companyId: leadId,
      companyName: lead?.companyName ?? null,
      planId,
      workflowType: snapshot.executionPlan.workflowType,
      approvalStatus,
      readinessState,
      preflightStatus,
      pilotEligible,
      pilotBlockedReasons,
      runtimeState,
      latestDryRunStatus,
      confidence,
    })

    plans.push({
      leadId,
      companyName: lead?.companyName ?? null,
      planId,
      executionPlan: snapshot.executionPlan,
      approvalStatus,
      readinessState,
      readinessReason,
      futureExecutionEligible,
      futureExecutionSummary,
      auditTrailSummary,
      handoffState,
      handoffSummary,
      boundaryClassification,
      boundarySummary,
      boundaryWarnings,
      preflightStatus,
      preflightSummary,
      preflightMissingRequirements,
      simulationStatus,
      simulationSummary,
      simulatedSuccessProbability,
      runtimeState,
      runtimeSummary,
      dryRunEligible,
      dryRunSummary,
      dryRunBlockedReasons,
      latestDryRunStatus,
      pilotEligible,
      pilotSummary,
      pilotBlockedReasons,
      pilotEnabled,
      runtimeEnabled,
      dryRunRequired,
      agentContext,
      orchestrationContext,
      agentEventContext,
      reason:
        snapshot.nextBestAction?.reason ??
        snapshot.opportunityAssessment?.summary ??
        snapshot.executionPlan.expectedOutcome,
      createdAt: snapshot.updatedAt ?? new Date(0).toISOString(),
      reviewUpdatedAt: review?.reviewedAt ?? null,
      observationHref: buildAiOsPilotLeadResearchHref(leadId) ?? `/growth/os/pilot/lead-research/${leadId}`,
    })
  }

  return plans
}

async function resolveExecutiveRuntimeForPlanningReview(
  admin: SupabaseClient,
  input: { organizationId: string; executiveRuntimeId?: string },
): Promise<{ executiveRuntimeId: string }> {
  if (input.executiveRuntimeId) {
    return { executiveRuntimeId: input.executiveRuntimeId }
  }

  const runtimes = await listAiExecutiveBrainRuntimes(admin, { organizationId: input.organizationId })
  if (runtimes[0]?.id) {
    return { executiveRuntimeId: runtimes[0].id }
  }

  const runtime = await upsertAiExecutiveBrainRuntime(admin, {
    organizationId: input.organizationId,
    instanceId: PLANNING_REVIEW_EXECUTIVE_INSTANCE_ID,
    runtimeStatus: "planning",
    metadata: { source: "ai_executive_mission_planning_review_service" },
  })
  return { executiveRuntimeId: runtime.id }
}

async function publishReviewEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string
    executiveRuntimeId: string
    operatorUserId: string
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "executive",
    producer: "executive_brain",
    source: "ai_executive_mission_planning_review_service",
    agentOwner: "executive_brain",
    missionId: input.missionId,
    correlationId: input.missionId,
    payload: {
      executive_runtime_id: input.executiveRuntimeId,
      operator_user_id: input.operatorUserId,
      ...(input.payload ?? {}),
    },
  })
}

export async function fetchExecutiveMissionPlanningReviewReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; executiveRuntimeId?: string },
): Promise<AiExecutiveMissionPlanningReviewReadModel> {
  const missionId = assertResolvableAiOsMissionId(input.missionId)
  const objective = await getGrowthObjective(admin, input.organizationId, missionId)
  if (!objective) throw new Error("growth_objective_not_found")

  const { executiveRuntimeId } = await resolveExecutiveRuntimeForPlanningReview(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
  })

  const activeWorkOrders = await listActiveWorkOrdersForMission(admin, {
    organizationId: input.organizationId,
    missionId,
  })

  const executivePlanningReport = await fetchAiExecutivePlanningReport(admin, {
    organizationId: input.organizationId,
    missionId,
  })

  const leadResearchExecutionPlans = await listLeadResearchExecutionPlansForMission(admin, {
    organizationId: input.organizationId,
    missionId,
    objectiveTitle: objective.title,
  })

  return {
    mission: mapMissionSummary(objective),
    executiveRuntimeId,
    activeWorkOrders,
    executivePlanningReport,
    leadResearchExecutionPlans,
    readOnly: true,
  }
}

export async function previewExecutiveMissionPlanningReview(
  admin: SupabaseClient,
  input: AiExecutiveMissionPlanningReviewPreviewInput,
): Promise<AiExecutiveMissionPlanningReviewPreviewResult> {
  const missionId = assertResolvableAiOsMissionId(input.missionId)
  const readModel = await fetchExecutiveMissionPlanningReviewReadModel(admin, {
    organizationId: input.organizationId,
    missionId,
    executiveRuntimeId: input.executiveRuntimeId,
  })

  const reviewId = randomUUID()
  const previewedAt = nowIso()

  await publishReviewEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.planning_review_created",
    missionId,
    executiveRuntimeId: readModel.executiveRuntimeId,
    operatorUserId: input.operatorUserId,
    payload: {
      review_id: reviewId,
      mode: "dry_run",
      source: input.source ?? "ai_executive_mission_planning_review_service",
    },
  })

  const tickResult = await runExecutiveMissionPlanningTick(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: readModel.executiveRuntimeId,
    missionId,
    mode: "dry_run",
    maxProposals: input.maxProposals,
    source: input.source ?? "ai_executive_mission_planning_review_service",
  })

  const duplicateSkippedProposals = tickResult.proposals.filter((proposal) => proposal.duplicate)
  const selectableProposals = selectableExecutiveWorkOrderProposals(tickResult.proposals)

  return {
    reviewId,
    mission: readModel.mission,
    executiveRuntimeId: readModel.executiveRuntimeId,
    missionStageId: tickResult.missionStageId,
    proposedWorkOrders: tickResult.proposals,
    selectableProposals,
    duplicateSkippedProposals,
    skippedDuplicates: tickResult.skippedDuplicates,
    activeWorkOrders: readModel.activeWorkOrders,
    dryRun: true,
    previewedAt,
  }
}

export async function approveExecutiveMissionPlanningReview(
  admin: SupabaseClient,
  input: AiExecutiveMissionPlanningReviewApproveInput,
): Promise<AiExecutiveMissionPlanningReviewApproveResult> {
  if (!input.reviewId.trim()) throw new Error("planning_review_id_required")

  const missionId = assertResolvableAiOsMissionId(input.missionId)
  const objective = await getGrowthObjective(admin, input.organizationId, missionId)
  if (!objective) throw new Error("growth_objective_not_found")

  const approvedAt = nowIso()

  await publishReviewEvent(admin, {
    organizationId: input.organizationId,
    eventType: "executive.planning_review_approved",
    missionId,
    executiveRuntimeId: input.executiveRuntimeId,
    operatorUserId: input.operatorUserId,
    payload: {
      review_id: input.reviewId,
      prepare_decision: input.prepareDecision ?? false,
      enable_ai_evidence: input.enableAiEvidence ?? false,
      source: input.source ?? "ai_executive_mission_planning_review_service",
    },
  })

  const tickResult = await runExecutiveMissionPlanningTick(admin, {
    organizationId: input.organizationId,
    executiveRuntimeId: input.executiveRuntimeId,
    missionId,
    mode: "create",
    prepareDecision: input.prepareDecision,
    enableAiEvidence: input.enableAiEvidence,
    maxProposals: input.maxProposals,
    source: input.source ?? "ai_executive_mission_planning_review_service",
  })

  return {
    reviewId: input.reviewId,
    missionId,
    executiveRuntimeId: input.executiveRuntimeId,
    created: tickResult.created,
    createdCount: tickResult.created.length,
    prepareDecision: input.prepareDecision ?? false,
    enableAiEvidence: input.enableAiEvidence ?? false,
    approvedAt,
    approvedByUserId: input.operatorUserId,
  }
}
