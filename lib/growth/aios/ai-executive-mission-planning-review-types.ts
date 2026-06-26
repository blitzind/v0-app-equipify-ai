/** GE-AIOS-3E — Executive Mission Planning Review types (client-safe). */

import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import type {
  AiExecutiveMissionPlanningCreatedWorkOrder,
  AiExecutiveWorkOrderProposal,
} from "@/lib/growth/aios/ai-executive-mission-planning-types"
import type { AiWorkOrderStatus, AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"
import type { AiExecutivePlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchFutureExecutionHandoffState } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"

export const GROWTH_AIOS_3E_PHASE = "GE-AIOS-3E" as const

export const GROWTH_AI_EXECUTIVE_MISSION_PLANNING_REVIEW_QA_MARKER =
  "growth-aios-3e-executive-mission-planning-review-v1" as const

export type AiExecutiveMissionPlanningMissionSummary = {
  missionId: string
  title: string
  status: string | null
  objectiveType: string | null
  currentStageId: GrowthObjectiveStageId | null
  running: boolean
}

export type AiExecutiveMissionPlanningActiveWorkOrderSummary = {
  workOrderId: string
  workOrderType: AiWorkOrderType
  status: AiWorkOrderStatus
  assignedAgent: string
  entityType: string | null
  entityId: string | null
  priority: number
  issuedAt: string
}

export type AiExecutiveMissionPlanningReviewReadModel = {
  mission: AiExecutiveMissionPlanningMissionSummary
  executiveRuntimeId: string
  activeWorkOrders: AiExecutiveMissionPlanningActiveWorkOrderSummary[]
  executivePlanningReport: AiExecutivePlanningReport
  leadResearchExecutionPlans: AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary[]
  readOnly: true
}

export type AiExecutiveMissionPlanningLeadResearchExecutionPlanSummary = {
  leadId: string
  companyName: string | null
  planId: string
  executionPlan: GrowthLeadResearchExecutionPlan
  approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | null
  readinessReason: string | null
  futureExecutionEligible: boolean | null
  futureExecutionSummary: string | null
  auditTrailSummary: string | null
  handoffState: GrowthLeadResearchFutureExecutionHandoffState | null
  handoffSummary: string | null
  reason: string
  createdAt: string
  reviewUpdatedAt: string | null
  observationHref: string
}

export type AiExecutiveMissionPlanningReviewPreviewInput = {
  organizationId: string
  missionId: string
  executiveRuntimeId?: string
  operatorUserId: string
  maxProposals?: number
  source?: string
}

export type AiExecutiveMissionPlanningReviewPreviewResult = {
  reviewId: string
  mission: AiExecutiveMissionPlanningMissionSummary
  executiveRuntimeId: string
  missionStageId: GrowthObjectiveStageId | null
  proposedWorkOrders: AiExecutiveWorkOrderProposal[]
  selectableProposals: AiExecutiveWorkOrderProposal[]
  duplicateSkippedProposals: AiExecutiveWorkOrderProposal[]
  skippedDuplicates: number
  activeWorkOrders: AiExecutiveMissionPlanningActiveWorkOrderSummary[]
  dryRun: true
  previewedAt: string
}

export type AiExecutiveMissionPlanningReviewApproveInput = {
  organizationId: string
  missionId: string
  reviewId: string
  executiveRuntimeId: string
  operatorUserId: string
  prepareDecision?: boolean
  enableAiEvidence?: boolean
  maxProposals?: number
  source?: string
}

export type AiExecutiveMissionPlanningReviewApproveResult = {
  reviewId: string
  missionId: string
  executiveRuntimeId: string
  created: AiExecutiveMissionPlanningCreatedWorkOrder[]
  createdCount: number
  prepareDecision: boolean
  enableAiEvidence: boolean
  approvedAt: string
  approvedByUserId: string
}

/** Operator review surface is read-only until explicit approval — no execution, outbound, or agent claiming. */
export const AI_EXECUTIVE_MISSION_PLANNING_REVIEW_RUNTIME_RULE =
  "Mission Planning Review exposes dry-run previews and requires explicit operator approval before Work Order creation — it never executes, sends outbound, enrolls, or claims Work Orders." as const
