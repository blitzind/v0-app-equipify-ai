/** Growth Engine S5-J — automation runtime execution helpers (client-safe). */

import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_METADATA_KEY,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
  type GrowthAutomationRuntimeApprovalGate,
  type GrowthAutomationRuntimeExecutionRun,
  type GrowthAutomationRuntimeExecutionStatus,
  type GrowthAutomationRuntimePendingJob,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"

export type AutomationRuntimeStepKind =
  | "trigger"
  | "approval"
  | "action"
  | "wait"
  | "condition"
  | "exit"
  | "unknown"

export function executionIssue(
  severity: GrowthAutomationValidationIssue["severity"],
  ruleCode: string,
  message: string,
): GrowthAutomationValidationIssue {
  return { severity, ruleCode, message, nodeId: null }
}

export function classifyAutomationRuntimeStep(input: {
  generationType: string | null
  channel: string | null
  stepOrder: number
}): AutomationRuntimeStepKind {
  const generationType = (input.generationType ?? "").trim()
  if (generationType === "trigger") return "trigger"
  if (generationType === "approval") return "approval"
  if (generationType === "exit") return "exit"
  if (generationType === "wait") return "wait"
  if (generationType === "condition" || generationType === "branch") return "condition"
  if (
    input.channel === "email" ||
    input.channel === "sms" ||
    input.channel === "voice_drop" ||
    generationType === "send_email" ||
    generationType === "send_sms" ||
    generationType === "send_voice_drop"
  ) {
    return "action"
  }
  if (input.stepOrder === 1 && !generationType) return "trigger"
  return "unknown"
}

export function resolveAutomationRuntimeCurrentStep(input: {
  currentStepOrder: number
  steps: GrowthSequenceEnrollmentStep[]
}): GrowthSequenceEnrollmentStep | null {
  const targetOrder = Math.max(1, input.currentStepOrder + 1)
  const byOrder = input.steps.find((step) => step.stepOrder === targetOrder)
  if (byOrder && !isExecutedAutomationStep(byOrder.status)) return byOrder

  return (
    input.steps.find(
      (step) =>
        !isExecutedAutomationStep(step.status) &&
        step.status !== "waiting" &&
        step.status !== "branch_skipped",
    ) ?? null
  )
}

export function isExecutedAutomationStep(status: string): boolean {
  return status === "executed" || status === "skipped" || status === "completed"
}

export function readAutomationExecutionMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const root = metadata?.[GROWTH_AUTOMATION_RUNTIME_EXECUTION_METADATA_KEY]
  return root && typeof root === "object" ? (root as Record<string, unknown>) : {}
}

export function mergeAutomationExecutionMetadata(
  metadata: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const current = readAutomationExecutionMetadata(metadata)
  return {
    ...(metadata ?? {}),
    [GROWTH_AUTOMATION_RUNTIME_EXECUTION_METADATA_KEY]: {
      qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
      ...current,
      ...patch,
      execution_enabled: false,
      updated_at: new Date().toISOString(),
    },
  }
}

export function buildAutomationRuntimeExecutionRun(input: {
  executionRunId: string
  flowId: string
  versionId: string
  compiledPatternId: string
  enrollmentId: string
  leadId: string
  currentStepId: string | null
  status: GrowthAutomationRuntimeExecutionStatus
  stepResults?: GrowthAutomationRuntimeExecutionRun["stepResults"]
  waitResults?: GrowthAutomationRuntimeExecutionRun["waitResults"]
  branchResults?: GrowthAutomationRuntimeExecutionRun["branchResults"]
  approvalGates?: GrowthAutomationRuntimeApprovalGate[]
  pendingJobs?: GrowthAutomationRuntimePendingJob[]
  warnings?: GrowthAutomationValidationIssue[]
  errors?: GrowthAutomationValidationIssue[]
  createdAt?: string
  updatedAt?: string
}): GrowthAutomationRuntimeExecutionRun {
  const now = new Date().toISOString()
  return {
    executionRunId: input.executionRunId,
    flowId: input.flowId,
    versionId: input.versionId,
    compiledPatternId: input.compiledPatternId,
    enrollmentId: input.enrollmentId,
    leadId: input.leadId,
    currentStepId: input.currentStepId,
    status: input.status,
    stepResults: input.stepResults ?? [],
    waitResults: input.waitResults ?? [],
    branchResults: input.branchResults ?? [],
    approvalGates: input.approvalGates ?? [],
    pendingJobs: input.pendingJobs ?? [],
    warnings: input.warnings ?? [],
    errors: input.errors ?? [],
    safety: GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

export function automationRuntimeExecutionSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS }
}

export function isTerminalAutomationRuntimeStatus(
  status: GrowthAutomationRuntimeExecutionStatus,
): boolean {
  return (
    status === "approval_required" ||
    status === "waiting" ||
    status === "blocked" ||
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  )
}
