/** GE-AIOS-GROWTH-5E — Autonomous Execution Agent Pilot types (client-safe). */

import type { GrowthLeadResearchExecutionDryRunStatus } from "@/lib/growth/aios/growth/growth-lead-research-execution-dry-run-types"
import type { GrowthLeadResearchExecutionState } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type { GrowthLeadResearchExecutionRuntimePilotWorkflow } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-pilot-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5E_PHASE = "GE-AIOS-GROWTH-5E" as const

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER =
  "growth-aios-growth-5e-autonomous-execution-pilot-v1" as const

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE =
  "Autonomous Execution Agent pilot in 5E — Execution Agent may wake for approved research_company plans after dry-run pass and full runtime gates under controlled_agent_wake. No outbound, Work Orders, providers, or Core mutations." as const

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT = "execution_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_EXECUTION_ENQUEUED_EVENT = "growth.execution.enqueued" as const

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW =
  "research_company" as const satisfies GrowthLeadResearchExecutionRuntimePilotWorkflow

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS = [
  "execution_plan_ready",
  "dry_run_passed",
  "stale_runtime_retry",
  "manual_execution_request",
] as const

export type GrowthAutonomousExecutionWakeCondition =
  (typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousExecutionPilotControlState =
  (typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET = {
  maxRunsPerHour: 5,
  maxRunsPerDay: 25,
  maxRetriesPerPlanPerDay: 2,
  cooldownAfterFailureMinutes: 30,
} as const

export type GrowthAutonomousExecutionRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousExecutionRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  planId: string
  wakeCondition: GrowthAutonomousExecutionWakeCondition
  outcome: GrowthAutonomousExecutionRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  executionId: string | null
  workflowType: string | null
  runtimeState: GrowthLeadResearchExecutionState | null
  skipReason: string | null
  blockReason: string | null
  dryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
  revenueOperatorHandoff: string | null
}

export type GrowthAutonomousExecutionPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  eligiblePlans: number
  queuedExecutions: number
  activeExecutions: number
  completedExecutions: number
  failedExecutions: number
  blockedExecutions: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  activeRuns: number
}

export type GrowthRevenueOperatorExecutionSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
  latestOutcomeRecommendation: string | null
}

export type GrowthAutonomousExecutionDecisionSummary = {
  leadId: string
  companyName: string | null
  planId: string
  executedAt: string
  executionId: string | null
  workflowType: string
  runtimeState: GrowthLeadResearchExecutionState | null
  outcome: GrowthAutonomousExecutionRunOutcome
}

export type GrowthAutonomousExecutionPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousExecutionPilotControlState
  enabled: boolean
  allowedWorkflow: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_ALLOWED_WORKFLOW
  disabledAgentKinds: GrowthAgentKind[]
  budgetLimits: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_BUDGET
  telemetry: GrowthAutonomousExecutionPilotTelemetry
  latestExecutions: GrowthAutonomousExecutionDecisionSummary[]
  recentRuns: GrowthAutonomousExecutionRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorExecutionSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousExecutionPilotPlanContext = {
  executionAgentOwner: typeof GROWTH_AUTONOMOUS_EXECUTION_PILOT_AGENT
  executionEligible: boolean
  dryRunRequired: true
  dryRunStatus: GrowthLeadResearchExecutionDryRunStatus | null
  runtimeState: GrowthLeadResearchExecutionState | null
  latestExecutionId: string | null
  latestExecutionResult: GrowthAutonomousExecutionRunOutcome | null
  blockedReason: string | null
  wakeRecommendation: string
  revenueOperatorHandoff: string | null
  workflowType: string | null
}

export type AiOsOperationsExecutionAgentStatus = {
  enabled: boolean
  controlState: GrowthAutonomousExecutionPilotControlState
  eligiblePlans: number
  queuedExecutions: number
  activeExecutions: number
  completedExecutions: number
  failedExecutions: number
  blockedExecutions: number
  budgetLabel: string
  latestEventSummary: string | null
  configureHref: string
}
