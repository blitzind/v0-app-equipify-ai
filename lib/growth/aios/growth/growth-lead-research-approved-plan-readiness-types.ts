/** GE-AIOS-GROWTH-1E — Approved Plan Readiness & Audit Trail (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchEvidenceSummary } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"

export const GROWTH_AIOS_GROWTH_1E_PHASE = "GE-AIOS-GROWTH-1E" as const

export const GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_QA_MARKER =
  "growth-aios-growth-1e-approved-plan-readiness-v1" as const

export const GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES = [
  "ready_for_future_execution",
  "blocked_missing_prerequisites",
  "blocked_low_confidence",
  "blocked_missing_approval",
  "not_applicable",
] as const

export type GrowthLeadResearchApprovedPlanReadinessState =
  (typeof GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_STATES)[number]

export const GROWTH_LEAD_RESEARCH_APPROVED_PLAN_CONFIDENCE_THRESHOLD = 0.55 as const

export type GrowthLeadResearchExecutionPlanAuditTrailEntry = {
  eventId: string
  eventType: string
  occurredAt: string
  summary: string
  detail: string | null
}

export type GrowthLeadResearchExecutionPlanAuditTrail = {
  leadId: string
  planId: string
  entries: GrowthLeadResearchExecutionPlanAuditTrailEntry[]
}

export type GrowthLeadResearchApprovedPlanReadinessItem = {
  planId: string
  leadId: string
  companyName: string | null
  recommendedWorkflow: string
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
  readinessReason: string
  missingPrerequisites: string[]
  evidenceSummary: GrowthLeadResearchEvidenceSummary | null
  estimatedDuration: string
  estimatedCost: GrowthLeadResearchExecutionPlan["estimatedCost"]
  confidence: number | null
  lastReviewedAt: string | null
  lastReviewerUserId: string | null
  lastReviewAction: string | null
  futureExecutionEligible: boolean
  futureExecutionSummary: string
  auditTrail: GrowthLeadResearchExecutionPlanAuditTrail
  observationHref: string
}

export const GROWTH_LEAD_RESEARCH_APPROVED_PLAN_READINESS_RUNTIME_RULE =
  "Approved Plan Readiness is read-only — it summarizes eligibility and audit history without creating Work Orders, sending outbound, or triggering execution." as const

export function resolveApprovedPlanReadinessState(input: {
  plan: GrowthLeadResearchExecutionPlan
  approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
  confidence: number | null
}): GrowthLeadResearchApprovedPlanReadinessState {
  if (input.approvalStatus !== "approved_for_future_execution") {
    return "blocked_missing_approval"
  }
  if (input.plan.workflowType === "close" || input.plan.executionReadiness === "not_applicable") {
    return "not_applicable"
  }
  if (input.plan.missingPrerequisites.length > 0) {
    return "blocked_missing_prerequisites"
  }
  if (input.confidence != null && input.confidence < GROWTH_LEAD_RESEARCH_APPROVED_PLAN_CONFIDENCE_THRESHOLD) {
    return "blocked_low_confidence"
  }
  return "ready_for_future_execution"
}

export function resolveApprovedPlanReadinessReason(
  state: GrowthLeadResearchApprovedPlanReadinessState,
  input: {
    plan: GrowthLeadResearchExecutionPlan
    approvalStatus: GrowthLeadResearchExecutionPlanApprovalStatus
    confidence: number | null
  },
): string {
  switch (state) {
    case "ready_for_future_execution":
      return "Operator approved plan with prerequisites satisfied and confidence above threshold — eligible for a future execution phase."
    case "blocked_missing_prerequisites":
      return `Missing prerequisites block future execution: ${input.plan.missingPrerequisites.join("; ")}`
    case "blocked_low_confidence":
      return `Confidence ${input.confidence != null ? Math.round(input.confidence * 100) : 0}% is below the ${Math.round(GROWTH_LEAD_RESEARCH_APPROVED_PLAN_CONFIDENCE_THRESHOLD * 100)}% readiness threshold.`
    case "blocked_missing_approval":
      return `Plan approval state is "${input.approvalStatus.replaceAll("_", " ")}" — operator approval for future execution is required.`
    case "not_applicable":
      return "Close or non-actionable workflow — future execution is not applicable."
    default:
      return "Readiness could not be determined."
  }
}

export function resolveFutureExecutionSummary(input: {
  plan: GrowthLeadResearchExecutionPlan
  readinessState: GrowthLeadResearchApprovedPlanReadinessState
}): { eligible: boolean; summary: string } {
  if (input.readinessState !== "ready_for_future_execution") {
    return {
      eligible: false,
      summary: `Future execution blocked — resolve ${input.readinessState.replaceAll("_", " ")} before any workflow run.`,
    }
  }

  const workflowLabel = input.plan.workflowType.replaceAll("_", " ")
  const steps = input.plan.estimatedSteps.map((step) => step.label).join(" → ")
  const workOrders =
    input.plan.requiredWorkOrders.length > 0
      ? input.plan.requiredWorkOrders.map((type) => type.replaceAll("_", " ")).join(", ")
      : "operator review gates only"

  return {
    eligible: true,
    summary: `Future phase would run ${workflowLabel} workflow (${steps}) with Work Order types: ${workOrders}. Each gate requires explicit operator approval — no autonomous outbound.`,
  }
}

export function summarizeExecutionPlanAuditTrail(entries: GrowthLeadResearchExecutionPlanAuditTrailEntry[]): string {
  if (entries.length === 0) return "No audit events recorded yet."
  const latest = entries[entries.length - 1]
  return `${entries.length} event(s) — latest: ${latest.summary} at ${new Date(latest.occurredAt).toLocaleString()}`
}
