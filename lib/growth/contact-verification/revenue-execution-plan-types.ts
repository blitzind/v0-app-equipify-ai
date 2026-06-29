/**
 * GE-IRE-8B — Canonical revenue execution plan artifact (versioned, forward-compatible).
 */

export const GROWTH_REVENUE_EXECUTION_PLAN_QA_MARKER = "revenue-execution-plan-v1" as const

export type RevenueExecutionPlanVersion = 1

export type RevenueExecutionState = "ready" | "blocked" | "waiting"

export type RevenueExecutionMode =
  | "human_review"
  | "approval_required"
  | "ready_for_execution"

export type RevenueRecommendedWorkflow =
  | "sequence_enrollment"
  | "verification"
  | "research"
  | "manual_review"
  | "monitor"

export type ExecutionStepStatus = "pending" | "blocked" | "optional"

export type ExecutionStep = {
  order: number
  id: string
  label: string
  description: string
  status: ExecutionStepStatus
  estimatedMinutes: number
}

/**
 * Duration estimation (REP v1) — base minutes per workflow.
 */
export const REVENUE_EXECUTION_PLAN_DURATION_MINUTES = {
  version: "rep-v1",
  verification: 5,
  research: 15,
  sequence_enrollment: 10,
  manual_review: 20,
  monitor: 2,
} as const

export type RevenueExecutionPlan = {
  version: RevenueExecutionPlanVersion
  companyId: string
  generatedAt: string
  executionState: RevenueExecutionState
  executionMode: RevenueExecutionMode
  recommendedWorkflow: RevenueRecommendedWorkflow
  executionSteps: ExecutionStep[]
  prerequisites: string[]
  approvalsRequired: string[]
  estimatedDurationMinutes: number
  confidence: number
  risks: string[]
  blockers: string[]
}
