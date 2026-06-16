/** Growth Engine S5-J — automation runtime execution types (client-safe). */

import type { GrowthAutomationValidationIssue } from "@/lib/growth/automation/growth-automation-types"

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER =
  "growth-automation-runtime-execution-s5j-v1" as const

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_METADATA_KEY = "automation_execution" as const

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_STATUSES = [
  "draft",
  "advanced",
  "waiting",
  "approval_required",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const
export type GrowthAutomationRuntimeExecutionStatus =
  (typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_STATUSES)[number]

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS = {
  runtime_execution_enabled: true,
  sequence_progression_enabled: true,
  message_send_execution_enabled: false,
  provider_execution_enabled: false,
  notifications_enabled: false,
  autonomous_approval_enabled: false,
  requires_human_review: true,
  enrollment_execution_enabled: true,
  sequence_execution_enabled: false,
  no_message_sends: true,
  no_provider_execution: true,
  no_notifications: true,
  no_background_jobs: true,
  no_autonomous_approval: true,
  no_cron_execution: true,
} as const

export type GrowthAutomationRuntimeExecutionSafetyFlags =
  typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS

export type GrowthAutomationRuntimeStepResult = {
  enrollmentStepId: string
  stepOrder: number
  stepKind: string
  status: string
  detail: string
}

export type GrowthAutomationRuntimeWaitResult = {
  waitId: string | null
  status: "waiting" | "resolved" | "timeout" | "none"
  detail: string
}

export type GrowthAutomationRuntimeBranchResult = {
  branchDecisionId: string | null
  selectedEdgeType: string | null
  status: "evaluated" | "waiting" | "blocked" | "none"
  detail: string
}

export type GrowthAutomationRuntimeApprovalGate = {
  gateId: string
  enrollmentId: string
  enrollmentStepId: string
  stepOrder: number
  status: "pending"
  requiredHumanApproval: true
  executionEnabled: false
  entryReason: string
  createdAt: string
}

export type GrowthAutomationRuntimePendingJob = {
  jobId: string
  enrollmentId: string
  enrollmentStepId: string
  stepOrder: number
  channel: string
  status: "pending_approval"
  executionEnabled: false
  requiresHumanApproval: true
  createdAt: string
}

export type GrowthAutomationRuntimeExecutionRun = {
  executionRunId: string
  flowId: string
  versionId: string
  compiledPatternId: string
  enrollmentId: string
  leadId: string
  currentStepId: string | null
  status: GrowthAutomationRuntimeExecutionStatus
  stepResults: GrowthAutomationRuntimeStepResult[]
  waitResults: GrowthAutomationRuntimeWaitResult[]
  branchResults: GrowthAutomationRuntimeBranchResult[]
  approvalGates: GrowthAutomationRuntimeApprovalGate[]
  pendingJobs: GrowthAutomationRuntimePendingJob[]
  warnings: GrowthAutomationValidationIssue[]
  errors: GrowthAutomationValidationIssue[]
  safety: GrowthAutomationRuntimeExecutionSafetyFlags
  createdAt: string
  updatedAt: string
}

export type GrowthAutomationRuntimeAdvanceInput = {
  flowId: string
  organizationId: string
  enrollmentId: string
  leadId?: string | null
  actingUserId?: string | null
  actingUserEmail?: string | null
}

export type GrowthAutomationRuntimeAdvanceUntilBlockedInput = GrowthAutomationRuntimeAdvanceInput & {
  maxSteps?: number
}

export type GrowthAutomationRuntimeCancelExecutionInput = {
  flowId: string
  organizationId: string
  enrollmentId: string
  leadId: string
  reason?: string
  actingUserId?: string | null
  actingUserEmail?: string | null
}
