/**
 * GE-AIOS-HOME-RUNTIME-OPTIMIZATION-1A — Bounded approval slice for Home (server-only).
 * Loads only HAC-required sources — never the full Command Center chain.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listAiWorkOrders } from "@/lib/growth/aios/ai-work-order-repository"
import type { AiWorkOrder } from "@/lib/growth/aios/ai-work-order-types"
import type {
  AiOsCommandCenterAttentionItem,
  AiOsCommandCenterWorkOrderSummary,
} from "@/lib/growth/aios/ai-os-command-center-types"
import { buildGrowthAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-service"
import { buildGrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-service"
import { buildGrowthLeadResearchExecutionPlanApprovalQueue } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-service"
import { buildAiOsMissionPlanningHref } from "@/lib/growth/aios/ai-os-public-routes"
import { GROWTH_HOME_HAC_TOTAL_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

export const GROWTH_HOME_APPROVAL_COMMAND_CENTER_SLICE_QA_MARKER =
  "ge-aios-home-runtime-optimization-1a-approval-slice-v1" as const

export type HomeApprovalCommandCenterSlice = Pick<
  import("@/lib/growth/aios/ai-os-command-center-types").AiOsCommandCenterReadModel,
  | "approvalWorkOrders"
  | "executionPlanReviewQueue"
  | "needsAttention"
  | "metaRecommender"
  | "priorityBinding"
  | "revenueOperator"
  | "autonomousOutreachPreparationPilot"
  | "autonomousMeetingPilot"
>

function mapWorkOrderSummary(workOrder: AiWorkOrder): AiOsCommandCenterWorkOrderSummary {
  return {
    workOrderId: workOrder.id,
    missionId: workOrder.missionId,
    workOrderType: workOrder.workOrderType,
    status: workOrder.status,
    assignedAgent: workOrder.assignedAgent,
    priority: workOrder.priority,
    updatedAt: workOrder.updatedAt,
    planningReviewHref: buildAiOsMissionPlanningHref(workOrder.missionId),
  }
}

export async function fetchHomeApprovalCommandCenterSlice(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt: string
  },
): Promise<HomeApprovalCommandCenterSlice> {
  const limit = GROWTH_HOME_HAC_TOTAL_LIMIT

  const [allWorkOrders, outreachPilot, meetingPilot, executionPlanReviewQueue] = await Promise.all([
    listAiWorkOrders(admin, { organizationId: input.organizationId, limit: 200 }).catch(() => []),
    buildGrowthAutonomousOutreachPreparationPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    buildGrowthAutonomousMeetingPilotReadModel(admin, {
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }).catch(() => null),
    buildGrowthLeadResearchExecutionPlanApprovalQueue(admin, {
      organizationId: input.organizationId,
      limit,
    }).catch(() => []),
  ])

  const approvalWorkOrders = allWorkOrders
    .filter((row) => row.status === "awaiting_approval" || row.status === "awaiting_decision")
    .slice(0, limit)
    .map(mapWorkOrderSummary)

  const needsAttention: AiOsCommandCenterAttentionItem[] = approvalWorkOrders.slice(0, 6).map((workOrder) => ({
    id: workOrder.workOrderId,
    title: `Approve ${workOrder.workOrderType.replaceAll("_", " ")}`,
    summary: `Work order ${workOrder.workOrderId.slice(0, 8)} awaiting approval.`,
    severity: workOrder.priority >= 700 ? "high" : "medium",
    href: workOrder.planningReviewHref ?? `/growth/os/missions/${workOrder.missionId}/planning`,
    missionId: workOrder.missionId,
    workOrderId: workOrder.workOrderId,
  }))

  return {
    approvalWorkOrders,
    executionPlanReviewQueue,
    needsAttention,
    metaRecommender: { recommendations: [] },
    priorityBinding: { bindings: [] },
    revenueOperator: { orchestrations: [] },
    autonomousOutreachPreparationPilot: {
      recentRuns: outreachPilot?.recentRuns ?? [],
    },
    autonomousMeetingPilot: {
      recentRuns: meetingPilot?.recentRuns ?? [],
    },
  }
}
