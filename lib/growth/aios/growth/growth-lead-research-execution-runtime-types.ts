/** GE-AIOS-GROWTH-3A — Execution Runtime Foundation (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthLeadResearchExecutionPlanApprovalStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessState } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchExecutionBoundaryClassification } from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchFutureExecutionHandoffState } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchExecutionPreflightStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import type { GrowthLeadResearchCanonicalWorkflowType } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"

export const GROWTH_AIOS_GROWTH_3A_PHASE = "GE-AIOS-GROWTH-3A" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER =
  "growth-aios-growth-3a-execution-runtime-v1" as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_FEATURE_FLAG =
  "GROWTH_AIOS_GROWTH_EXECUTION_RUNTIME_ENABLED" as const

/** Execution remains disabled until explicitly enabled by operator configuration. */
export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_DEFAULT_ENABLED = false as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES = {
  lifecycleChanged: "growth.execution_runtime.lifecycle_changed",
  stepCompleted: "growth.execution_runtime.step_completed",
  auditRecorded: "growth.execution_runtime.audit_recorded",
} as const

export const GROWTH_LEAD_RESEARCH_EXECUTION_STATES = [
  "queued",
  "validating",
  "ready",
  "executing",
  "paused",
  "completed",
  "cancelled",
  "failed",
] as const

export type GrowthLeadResearchExecutionState = (typeof GROWTH_LEAD_RESEARCH_EXECUTION_STATES)[number]

export const GROWTH_LEAD_RESEARCH_INTERNAL_MUTATION_RUNTIME_WORKFLOWS = [
  "verify_email",
  "buying_committee",
  "research_company",
  "meeting_preparation",
] as const

export type GrowthLeadResearchInternalMutationRuntimeWorkflow =
  (typeof GROWTH_LEAD_RESEARCH_INTERNAL_MUTATION_RUNTIME_WORKFLOWS)[number]

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_BLOCK_CODES = [
  "runtime_disabled",
  "unsupported_workflow",
  "classification_not_internal",
  "approval_missing",
  "readiness_blocked",
  "handoff_blocked",
  "preflight_blocked",
  "boundary_blocked",
  "invalid_transition",
  "execution_not_found",
  "execution_terminal",
] as const

export type GrowthLeadResearchExecutionRuntimeBlockCode =
  (typeof GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_BLOCK_CODES)[number]

export type GrowthLeadResearchExecutionRuntimeGateSnapshot = {
  runtimeEnabled: boolean
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | "not_applicable"
  handoffState: GrowthLeadResearchFutureExecutionHandoffState | "not_evaluated"
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus | "not_evaluated"
  boundaryClassification: GrowthLeadResearchExecutionBoundaryClassification | "not_evaluated"
  runtimeImplementationAllowed: boolean
  futureExecutionAllowed: boolean
}

export type GrowthLeadResearchExecutionRuntimeValidationResult = {
  allowed: boolean
  blockCode: GrowthLeadResearchExecutionRuntimeBlockCode | null
  blockReason: string | null
  gateSnapshot: GrowthLeadResearchExecutionRuntimeGateSnapshot
}

export type GrowthLeadResearchExecutionContextMutation = {
  mutationId: string
  stepId: string
  mutationType: string
  scope: "growth_internal"
  recordedAt: string
  summary: string
  payload: Record<string, unknown>
}

export type GrowthLeadResearchExecutionContext = {
  executionId: string
  planId: string
  leadId: string
  organizationId: string
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow
  executionPlan: GrowthLeadResearchExecutionPlan
  startedAt: string
  gateSnapshot: GrowthLeadResearchExecutionRuntimeGateSnapshot
  internalMutations: GrowthLeadResearchExecutionContextMutation[]
  outboundActionsAttempted: number
  providerCallsAttempted: number
  coreMutationsAttempted: number
}

export type GrowthLeadResearchExecutionStepProgress = {
  stepId: string
  label: string
  status: "pending" | "running" | "completed" | "skipped" | "failed"
  startedAt: string | null
  completedAt: string | null
  mutationId: string | null
  error: string | null
}

export type GrowthLeadResearchExecutionRecord = {
  executionId: string
  organizationId: string
  planId: string
  leadId: string
  companyName: string | null
  missionId: string | null
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow
  state: GrowthLeadResearchExecutionState
  executionPlan: GrowthLeadResearchExecutionPlan
  context: GrowthLeadResearchExecutionContext | null
  steps: GrowthLeadResearchExecutionStepProgress[]
  currentStepIndex: number
  gateSnapshot: GrowthLeadResearchExecutionRuntimeGateSnapshot | null
  blockCode: GrowthLeadResearchExecutionRuntimeBlockCode | null
  blockReason: string | null
  queuedAt: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
  operatorUserId: string | null
}

export type GrowthLeadResearchExecutionAuditEntry = {
  auditId: string
  executionId: string
  eventType: string
  occurredAt: string
  previousState: GrowthLeadResearchExecutionState | null
  nextState: GrowthLeadResearchExecutionState | null
  stepId: string | null
  summary: string
  detail: string | null
  metadata: Record<string, unknown>
}

export type GrowthLeadResearchExecutionRuntimeSummaryItem = {
  executionId: string
  planId: string
  leadId: string
  companyName: string | null
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow
  state: GrowthLeadResearchExecutionState
  stepsCompleted: number
  stepsTotal: number
  blockReason: string | null
  queuedAt: string
  updatedAt: string
  observationHref: string | null
}

export type GrowthLeadResearchExecutionRuntimeSystemSummary = {
  runtimeEnabled: boolean
  queuedCount: number
  activeCount: number
  pausedCount: number
  completedCount: number
  failedCount: number
  cancelledCount: number
  headline: string
}

export type GrowthLeadResearchExecutionRuntimeReadModel = {
  qaMarker: typeof GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER
  generatedAt: string
  runtimeEnabled: boolean
  runtimeRule: typeof GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE
  systemSummary: GrowthLeadResearchExecutionRuntimeSystemSummary
  queuedExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  activeExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  pausedExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  completedExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  failedExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
  cancelledExecutions: GrowthLeadResearchExecutionRuntimeSummaryItem[]
}

export const GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_RULE =
  "Execution Runtime executes internal_mutation_only Growth workflows sequentially — no outbound, no provider calls, no Equipify Core mutations. Disabled by default." as const

export function isInternalMutationRuntimeWorkflow(
  workflowType: GrowthLeadResearchCanonicalWorkflowType,
): workflowType is GrowthLeadResearchInternalMutationRuntimeWorkflow {
  return (GROWTH_LEAD_RESEARCH_INTERNAL_MUTATION_RUNTIME_WORKFLOWS as readonly string[]).includes(
    workflowType,
  )
}

export function buildExecutionId(planId: string): string {
  return `glr-exec:${planId}`
}

export function buildExecutionAuditId(executionId: string, sequence: number): string {
  return `${executionId}:audit:${sequence}`
}

export function buildExecutionMutationId(executionId: string, stepId: string): string {
  return `${executionId}:mut:${stepId}`
}

const TERMINAL_STATES = new Set<GrowthLeadResearchExecutionState>([
  "completed",
  "cancelled",
  "failed",
])

const ACTIVE_STATES = new Set<GrowthLeadResearchExecutionState>([
  "validating",
  "ready",
  "executing",
])

export function isTerminalExecutionState(state: GrowthLeadResearchExecutionState): boolean {
  return TERMINAL_STATES.has(state)
}

export function isActiveExecutionState(state: GrowthLeadResearchExecutionState): boolean {
  return ACTIVE_STATES.has(state)
}

const ALLOWED_TRANSITIONS: Record<
  GrowthLeadResearchExecutionState,
  GrowthLeadResearchExecutionState[]
> = {
  queued: ["validating", "cancelled"],
  validating: ["ready", "failed", "cancelled"],
  ready: ["executing", "cancelled"],
  executing: ["paused", "completed", "failed", "cancelled"],
  paused: ["executing", "cancelled"],
  completed: [],
  cancelled: [],
  failed: [],
}

export function canTransitionExecutionState(
  from: GrowthLeadResearchExecutionState,
  to: GrowthLeadResearchExecutionState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertExecutionTransition(
  from: GrowthLeadResearchExecutionState,
  to: GrowthLeadResearchExecutionState,
): { ok: true } | { ok: false; blockCode: "invalid_transition"; message: string } {
  if (!canTransitionExecutionState(from, to)) {
    return {
      ok: false,
      blockCode: "invalid_transition",
      message: `Cannot transition execution from ${from} to ${to}.`,
    }
  }
  return { ok: true }
}

export function buildInitialStepProgress(
  plan: GrowthLeadResearchExecutionPlan,
): GrowthLeadResearchExecutionStepProgress[] {
  return plan.estimatedSteps.map((step) => ({
    stepId: step.stepId,
    label: step.label,
    status: "pending",
    startedAt: null,
    completedAt: null,
    mutationId: null,
    error: null,
  }))
}

export function validateExecutionRuntimeGates(input: {
  runtimeEnabled: boolean
  workflowType: GrowthLeadResearchCanonicalWorkflowType
  approvalState: GrowthLeadResearchExecutionPlanApprovalStatus
  readinessState: GrowthLeadResearchApprovedPlanReadinessState | "not_applicable"
  handoffState: GrowthLeadResearchFutureExecutionHandoffState | "not_evaluated"
  preflightStatus: GrowthLeadResearchExecutionPreflightStatus | "not_evaluated"
  boundaryClassification: GrowthLeadResearchExecutionBoundaryClassification | "not_evaluated"
  runtimeImplementationAllowed: boolean
  futureExecutionAllowed: boolean
}): GrowthLeadResearchExecutionRuntimeValidationResult {
  const gateSnapshot: GrowthLeadResearchExecutionRuntimeGateSnapshot = {
    runtimeEnabled: input.runtimeEnabled,
    approvalState: input.approvalState,
    readinessState: input.readinessState,
    handoffState: input.handoffState,
    preflightStatus: input.preflightStatus,
    boundaryClassification: input.boundaryClassification,
    runtimeImplementationAllowed: input.runtimeImplementationAllowed,
    futureExecutionAllowed: input.futureExecutionAllowed,
  }

  if (!input.runtimeEnabled) {
    return {
      allowed: false,
      blockCode: "runtime_disabled",
      blockReason: "Execution runtime is disabled by default.",
      gateSnapshot,
    }
  }

  if (!isInternalMutationRuntimeWorkflow(input.workflowType)) {
    return {
      allowed: false,
      blockCode: "unsupported_workflow",
      blockReason: `Workflow ${input.workflowType} is planning-only in GE-AIOS-GROWTH-3A.`,
      gateSnapshot,
    }
  }

  if (input.boundaryClassification !== "internal_mutation_only") {
    return {
      allowed: false,
      blockCode: "classification_not_internal",
      blockReason: `Boundary classification ${input.boundaryClassification} is not internal_mutation_only.`,
      gateSnapshot,
    }
  }

  if (!input.futureExecutionAllowed) {
    return {
      allowed: false,
      blockCode: "boundary_blocked",
      blockReason: "Boundary audit disallows future execution for this workflow.",
      gateSnapshot,
    }
  }

  if (input.approvalState !== "approved_for_future_execution") {
    return {
      allowed: false,
      blockCode: "approval_missing",
      blockReason: `Approval state is ${input.approvalState.replaceAll("_", " ")}.`,
      gateSnapshot,
    }
  }

  if (input.readinessState !== "ready_for_future_execution") {
    return {
      allowed: false,
      blockCode: "readiness_blocked",
      blockReason: `Readiness state is ${input.readinessState.replaceAll("_", " ")}.`,
      gateSnapshot,
    }
  }

  if (input.handoffState !== "handoff_ready") {
    return {
      allowed: false,
      blockCode: "handoff_blocked",
      blockReason: `Handoff state is ${input.handoffState.replaceAll("_", " ")}.`,
      gateSnapshot,
    }
  }

  if (!input.runtimeImplementationAllowed || input.preflightStatus !== "preflight_passed") {
    return {
      allowed: false,
      blockCode: "preflight_blocked",
      blockReason: `Preflight status is ${input.preflightStatus.replaceAll("_", " ")}.`,
      gateSnapshot,
    }
  }

  return {
    allowed: true,
    blockCode: null,
    blockReason: null,
    gateSnapshot,
  }
}

export function summarizeExecutionRuntimeRecord(
  record: GrowthLeadResearchExecutionRecord,
  observationHref: string | null = null,
): GrowthLeadResearchExecutionRuntimeSummaryItem {
  const stepsCompleted = record.steps.filter((step) => step.status === "completed").length
  return {
    executionId: record.executionId,
    planId: record.planId,
    leadId: record.leadId,
    companyName: record.companyName,
    workflowType: record.workflowType,
    state: record.state,
    stepsCompleted,
    stepsTotal: record.steps.length,
    blockReason: record.blockReason,
    queuedAt: record.queuedAt,
    updatedAt: record.updatedAt,
    observationHref,
  }
}

export function buildExecutionRuntimeSystemSummary(input: {
  runtimeEnabled: boolean
  records: GrowthLeadResearchExecutionRecord[]
}): GrowthLeadResearchExecutionRuntimeSystemSummary {
  const queuedCount = input.records.filter((row) => row.state === "queued").length
  const activeCount = input.records.filter((row) => isActiveExecutionState(row.state)).length
  const pausedCount = input.records.filter((row) => row.state === "paused").length
  const completedCount = input.records.filter((row) => row.state === "completed").length
  const failedCount = input.records.filter((row) => row.state === "failed").length
  const cancelledCount = input.records.filter((row) => row.state === "cancelled").length

  return {
    runtimeEnabled: input.runtimeEnabled,
    queuedCount,
    activeCount,
    pausedCount,
    completedCount,
    failedCount,
    cancelledCount,
    headline: input.runtimeEnabled
      ? `${input.records.length} runtime executions — ${activeCount} active, ${pausedCount} paused, ${completedCount} completed.`
      : "Execution runtime disabled — queue and lifecycle infrastructure available in read-only mode.",
  }
}
