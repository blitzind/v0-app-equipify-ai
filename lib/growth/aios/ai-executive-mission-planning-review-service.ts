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
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
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

  return {
    mission: mapMissionSummary(objective),
    executiveRuntimeId,
    activeWorkOrders,
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
