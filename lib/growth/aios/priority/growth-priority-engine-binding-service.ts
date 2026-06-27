/** GE-AI-2E — Priority Engine Binding service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AiOsCommandCenterActiveMission,
  AiOsCommandCenterReadModel,
  AiOsCommandCenterWorkOrderSummary,
} from "@/lib/growth/aios/ai-os-command-center-types"
import { buildRevenueOperatorReadModel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-service"
import { buildGrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-service"
import { resolveExecutiveMissionPlanningStage } from "@/lib/growth/aios/ai-executive-mission-planning-planner"
import { buildAiOsMissionPlanningHref } from "@/lib/growth/aios/ai-os-public-routes"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  synthesizeGrowthPriorityEngineBindingReadModel,
  type GrowthPriorityEngineBindingInput,
} from "@/lib/growth/aios/priority/growth-priority-engine-binding-engine"
import type { GrowthCalibrationActiveConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import { resolvePriorityEngineMetaMultiplier } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { listGrowthObjectives } from "@/lib/growth/objectives/growth-objective-repository"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"

function isActiveObjective(objective: GrowthObjective): boolean {
  return objective.status === "active" || objective.status === "planning"
}

function mapApprovalWorkOrders(workOrders: Awaited<ReturnType<typeof listAiWorkOrders>>): AiOsCommandCenterWorkOrderSummary[] {
  return workOrders
    .filter((row) => row.status === "awaiting_approval" || row.status === "awaiting_decision")
    .slice(0, 50)
    .map((row) => ({
      workOrderId: row.id,
      missionId: row.missionId,
      workOrderType: row.workOrderType,
      status: row.status,
      assignedAgent: row.assignedAgent,
      priority: row.priority,
      updatedAt: row.updatedAt,
      planningReviewHref: buildAiOsMissionPlanningHref(row.missionId),
    }))
}

function mapActiveMissions(objectives: GrowthObjective[]): AiOsCommandCenterActiveMission[] {
  return objectives.filter(isActiveObjective).slice(0, 50).map((objective) => ({
    missionId: objective.id,
    title: objective.title,
    status: objective.status,
    objectiveType: objective.objectiveType,
    currentStageId: resolveExecutiveMissionPlanningStage(objective),
    running: objective.runtime?.running ?? false,
    progressPercent: 0,
    activeWorkOrderCount: 0,
    planningReviewHref: buildAiOsMissionPlanningHref(objective.id) ?? "/growth/os/missions",
  }))
}

export function buildGrowthPriorityEngineBindingReadModel(input: {
  organizationId: string
  generatedAt: string
  objectives: GrowthObjective[]
  commandCenter: Pick<
    AiOsCommandCenterReadModel,
    | "activeMissions"
    | "approvalWorkOrders"
    | "missionPriority"
    | "metaRecommender"
    | "revenueOperator"
  >
  autonomyPolicy?: GrowthAiOsAutonomyPolicyReadModel
  calibrationActiveConfigs?: GrowthCalibrationActiveConfig[]
  topLimit?: number
  totalLimit?: number
}): GrowthPriorityEngineBindingReadModel {
  const priorityConfig = input.calibrationActiveConfigs?.find((row) => row.targetSystem === "priority_engine")
  const metaScoreMultiplier = resolvePriorityEngineMetaMultiplier({
    organizationId: input.organizationId,
    activeConfig: priorityConfig?.config,
  })

  const engineInput: GrowthPriorityEngineBindingInput = {
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    objectives: input.objectives,
    activeMissions: input.commandCenter.activeMissions,
    approvalWorkOrders: input.commandCenter.approvalWorkOrders,
    missionPriority: input.commandCenter.missionPriority,
    metaRecommendations: input.commandCenter.metaRecommender.recommendations,
    orchestrations: input.commandCenter.revenueOperator.orchestrations,
    metaScoreMultiplier,
    topLimit: input.topLimit,
    totalLimit: input.totalLimit,
    policyContext: input.autonomyPolicy
      ? {
          emergencyStopActive: input.autonomyPolicy.emergencyStopActive,
          autonomyEnabled: input.autonomyPolicy.autonomyEnabled,
        }
      : undefined,
  }

  return synthesizeGrowthPriorityEngineBindingReadModel(engineInput)
}

export function findObjectivePriorityBindingContext(
  readModel: GrowthPriorityEngineBindingReadModel,
  objectiveId: string,
) {
  return readModel.objectiveContexts.find((row) => row.objectiveId === objectiveId) ?? null
}

export async function fetchGrowthPriorityEngineBindingReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; autonomyPolicy?: GrowthAiOsAutonomyPolicyReadModel },
): Promise<GrowthPriorityEngineBindingReadModel> {
  const generatedAt = new Date().toISOString()
  const [objectives, workOrders, missionPriority, revenueOperator, autonomyPolicy] = await Promise.all([
    listGrowthObjectives(admin, input.organizationId),
    listAiWorkOrders(admin, { organizationId: input.organizationId, limit: 200 }),
    buildGrowthMissionPriorityReadModel(admin, { organizationId: input.organizationId, generatedAt }),
    buildRevenueOperatorReadModel(admin, { organizationId: input.organizationId, generatedAt }),
    input.autonomyPolicy ?? fetchGrowthAiOsAutonomyPolicy(admin, { organizationId: input.organizationId, generatedAt }),
  ])

  const engineInput: GrowthPriorityEngineBindingInput = {
    organizationId: input.organizationId,
    generatedAt,
    objectives,
    activeMissions: mapActiveMissions(objectives),
    approvalWorkOrders: mapApprovalWorkOrders(workOrders),
    missionPriority,
    metaRecommendations: [],
    orchestrations: revenueOperator.orchestrations,
    policyContext: {
      emergencyStopActive: autonomyPolicy.emergencyStopActive,
      autonomyEnabled: autonomyPolicy.autonomyEnabled,
    },
  }

  return synthesizeGrowthPriorityEngineBindingReadModel(engineInput)
}
