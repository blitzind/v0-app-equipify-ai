/** GE-AIOS-GROWTH-1D — Execution Plan Approval Queue (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"

export const GROWTH_AIOS_GROWTH_1D_PHASE = "GE-AIOS-GROWTH-1D" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_QA_MARKER =
  "growth-aios-growth-1d-execution-plan-review-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_EVENT =
  "growth.execution_plan.review_changed" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES = [
  "pending_review",
  "approved_for_future_execution",
  "needs_changes",
  "blocked",
  "dismissed",
] as const

export type GrowthLeadResearchExecutionPlanApprovalStatus =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_APPROVAL_STATUSES)[number]

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_ACTIONS = [
  "approve_for_future_execution",
  "mark_needs_changes",
  "block_plan",
  "dismiss_plan",
] as const

export type GrowthLeadResearchExecutionPlanReviewAction =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_ACTIONS)[number]

export type GrowthLeadResearchExecutionPlanQueueItem = {
  planId: string
  leadId: string
  companyName: string | null
  recommendedWorkflow: string
  readinessStatus: GrowthLeadResearchExecutionPlan["executionReadiness"]
  approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
  approvalRequired: boolean
  missingPrerequisites: string[]
  estimatedDuration: string
  estimatedCost: GrowthLeadResearchExecutionPlan["estimatedCost"]
  confidence: number | null
  reason: string
  createdAt: string
  reviewUpdatedAt: string | null
  reviewedByUserId: string | null
  observationHref: string
}

export type GrowthLeadResearchExecutionPlanReviewRecord = {
  planId: string
  leadId: string
  approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
  action: GrowthLeadResearchExecutionPlanReviewAction
  operatorUserId: string
  note: string | null
  reviewedAt: string
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_PLAN_REVIEW_RUNTIME_RULE =
  "Execution Plan Review updates planning state only — it never creates Work Orders, sends outbound, enrolls sequences, or triggers autonomous execution." as const

export function buildGrowthLeadResearchExecutionPlanId(input: {
  leadId: string
  plan: Pick<GrowthLeadResearchExecutionPlan, "workflowType" | "nextBestActionKind">
}): string {
  return `glr-ep:${input.leadId}:${input.plan.workflowType}:${input.plan.nextBestActionKind}`
}

export function resolveInitialExecutionPlanApprovalStatus(
  plan: GrowthLeadResearchExecutionPlan,
): GrowthLeadResearchExecutionPlanApprovalStatus {
  if (plan.workflowType === "close" || plan.executionReadiness === "not_applicable") {
    return "dismissed"
  }
  if (plan.executionReadiness === "blocked" || plan.missingPrerequisites.length > 0) {
    return "blocked"
  }
  return "pending_review"
}

export function mapExecutionPlanReviewActionToStatus(
  action: GrowthLeadResearchExecutionPlanReviewAction,
): GrowthLeadResearchExecutionPlanApprovalStatus {
  switch (action) {
    case "approve_for_future_execution":
      return "approved_for_future_execution"
    case "mark_needs_changes":
      return "needs_changes"
    case "block_plan":
      return "blocked"
    case "dismiss_plan":
      return "dismissed"
    default:
      return "pending_review"
  }
}

export function resolveEffectiveExecutionPlanApprovalStatus(input: {
  plan: GrowthLeadResearchExecutionPlan
  review: GrowthLeadResearchExecutionPlanReviewRecord | null
  planId: string
}): GrowthLeadResearchExecutionPlanApprovalStatus {
  if (input.review && input.review.planId === input.planId) {
    return input.review.approvalStatus
  }
  return resolveInitialExecutionPlanApprovalStatus(input.plan)
}
