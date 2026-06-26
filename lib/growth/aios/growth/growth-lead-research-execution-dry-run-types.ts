/** GE-AIOS-GROWTH-3B — Internal Workflow Dry Run (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import {
  isInternalMutationRuntimeWorkflow,
  type GrowthLeadResearchExecutionContextMutation,
  type GrowthLeadResearchExecutionRuntimeValidationResult,
  type GrowthLeadResearchExecutionState,
  type GrowthLeadResearchExecutionStepProgress,
  type GrowthLeadResearchInternalMutationRuntimeWorkflow,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export const GROWTH_AIOS_GROWTH_3B_PHASE = "GE-AIOS-GROWTH-3B" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_QA_MARKER =
  "growth-aios-growth-3b-execution-dry-run-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES = [
  "dry_run_passed",
  "dry_run_blocked",
  "dry_run_failed_gate_validation",
  "dry_run_not_allowed",
] as const

export type GrowthLeadResearchExecutionDryRunStatus =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_STATUSES)[number]

export type GrowthLeadResearchExecutionDryRunSimulatedTransition = {
  previousState: GrowthLeadResearchExecutionState | null
  nextState: GrowthLeadResearchExecutionState
  occurredAt: string
  summary: string
}

export type GrowthLeadResearchExecutionDryRunSimulatedStep = {
  stepId: string
  label: string
  status: GrowthLeadResearchExecutionStepProgress["status"]
  startedAt: string | null
  completedAt: string | null
  mutationId: string | null
  error: string | null
}

export type GrowthLeadResearchExecutionDryRunPredictedAuditEvent = {
  eventType: string
  occurredAt: string
  previousState: GrowthLeadResearchExecutionState | null
  nextState: GrowthLeadResearchExecutionState | null
  stepId: string | null
  summary: string
}

export type GrowthLeadResearchExecutionDryRunSideEffectCounters = {
  providerCalls: number
  outboundActions: number
  coreMutations: number
  workOrdersCreated: number
}

export type GrowthLeadResearchExecutionDryRunReport = {
  dryRunId: string
  planId: string
  leadId: string
  organizationId: string
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow | string
  gateResults: GrowthLeadResearchExecutionRuntimeValidationResult
  simulatedStateTransitions: GrowthLeadResearchExecutionDryRunSimulatedTransition[]
  simulatedSteps: GrowthLeadResearchExecutionDryRunSimulatedStep[]
  simulatedInternalMutations: GrowthLeadResearchExecutionContextMutation[]
  blockedReasons: string[]
  predictedAuditEvents: GrowthLeadResearchExecutionDryRunPredictedAuditEvent[]
  sideEffectCounters: GrowthLeadResearchExecutionDryRunSideEffectCounters
  finalStatus: GrowthLeadResearchExecutionDryRunStatus
  generatedAt: string
  nonPersistent: true
}

export type GrowthLeadResearchExecutionDryRunEligiblePlan = {
  planId: string
  leadId: string
  companyName: string | null
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  confidence: number | null
  executionPlan: GrowthLeadResearchExecutionPlan
  observationHref: string | null
}

export type GrowthLeadResearchExecutionDryRunEligibilityPreview = {
  eligible: boolean
  summary: string
  blockedReasons: string[]
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_DRY_RUN_RULE =
  "Dry run simulates the execution runtime gate chain and internal steps in memory only — no persistence, no AI OS events, no providers, no outbound, no Work Orders, no Core mutations." as const

export function buildDryRunId(planId: string, now?: string): string {
  const stamp = (now ?? new Date().toISOString()).replace(/[:.]/g, "-")
  return `glr-dry-run:${planId}:${stamp}`
}

export function buildDryRunExecutionId(planId: string): string {
  return `glr-dry-run-exec:${planId}`
}

export function buildDryRunMutationId(dryRunId: string, stepId: string): string {
  return `${dryRunId}:mut:${stepId}`
}

export const DRY_RUN_ZERO_SIDE_EFFECT_COUNTERS: GrowthLeadResearchExecutionDryRunSideEffectCounters = {
  providerCalls: 0,
  outboundActions: 0,
  coreMutations: 0,
  workOrdersCreated: 0,
}

export function summarizeDryRunReport(report: GrowthLeadResearchExecutionDryRunReport): string {
  const stepsCompleted = report.simulatedSteps.filter((step) => step.status === "completed").length
  const stepsTotal = report.simulatedSteps.length
  return `${report.finalStatus.replaceAll("_", " ")} — ${stepsCompleted}/${stepsTotal} steps simulated (non-persistent).`
}

export function buildDryRunEligibilityPreview(input: {
  workflowType: string
  validation: GrowthLeadResearchExecutionRuntimeValidationResult | null
}): GrowthLeadResearchExecutionDryRunEligibilityPreview {
  if (!isInternalMutationRuntimeWorkflow(input.workflowType as never)) {
    return {
      eligible: false,
      summary: `${input.workflowType.replaceAll("_", " ")} is not eligible for internal workflow dry-run.`,
      blockedReasons: ["Workflow is not an internal_mutation_only runtime workflow."],
    }
  }

  if (!input.validation) {
    return {
      eligible: true,
      summary: "Eligible for internal workflow dry-run — run from Command Center to validate gates.",
      blockedReasons: [],
    }
  }

  if (!input.validation.allowed) {
    return {
      eligible: true,
      summary: "Dry-run eligible — gate validation would block real execution.",
      blockedReasons: input.validation.blockReason ? [input.validation.blockReason] : [],
    }
  }

  return {
    eligible: true,
    summary: "Dry-run eligible — gates would pass for internal workflow execution.",
    blockedReasons: [],
  }
}
