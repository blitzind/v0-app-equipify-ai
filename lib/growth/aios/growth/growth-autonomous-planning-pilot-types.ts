/** GE-AIOS-GROWTH-5D — Autonomous Planning Agent Pilot types (client-safe). */

import type { GrowthLeadResearchExecutionPlan } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5D_PHASE = "GE-AIOS-GROWTH-5D" as const

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER =
  "growth-aios-growth-5d-autonomous-planning-pilot-v1" as const

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE =
  "Autonomous Planning Agent pilot in 5D — Planning Agent may wake after successful qualification to generate deterministic execution plans under controlled_agent_wake with budget limits. No runtime, outbound, Work Orders, or Core mutations." as const

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT = "planning_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_PLANNING_EXECUTION_PLAN_GENERATED_EVENT =
  "growth.execution_plan.generated" as const

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_MIN_CONFIDENCE = 0.45 as const

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS = [
  "qualification_completed",
  "stale_execution_plan",
  "manual_planning_request",
] as const

export type GrowthAutonomousPlanningWakeCondition =
  (typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousPlanningPilotControlState =
  (typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET = {
  maxRunsPerHour: 15,
  maxRunsPerDay: 150,
  maxRetriesPerLeadPerDay: 2,
  cooldownAfterFailureMinutes: 30,
} as const

export type GrowthAutonomousPlanningRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousPlanningRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousPlanningWakeCondition
  outcome: GrowthAutonomousPlanningRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  planId: string | null
  workflowType: string | null
  confidence: number | null
  executionReadiness: GrowthLeadResearchExecutionPlan["executionReadiness"] | null
  skipReason: string | null
  reasoning: string | null
  expectedOutcome: string | null
  requiredApprovals: string[]
  prerequisites: string[]
  revenueOperatorHandoff: string | null
}

export type GrowthAutonomousPlanningPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  eligibleLeads: number
  plansGenerated: number
  blockedPlanning: number
  averageDurationMs: number
  averageConfidence: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  activeRuns: number
}

export type GrowthRevenueOperatorPlanningSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
  latestHandoffRecommendation: string | null
}

export type GrowthAutonomousPlanningDecisionSummary = {
  leadId: string
  companyName: string | null
  plannedAt: string
  planId: string
  workflowType: string
  confidence: number
  executionReadiness: GrowthLeadResearchExecutionPlan["executionReadiness"]
  expectedOutcome: string
  nextBestAction: string
}

export type GrowthAutonomousPlanningPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousPlanningPilotControlState
  enabled: boolean
  disabledAgentKinds: GrowthAgentKind[]
  budgetLimits: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_BUDGET
  telemetry: GrowthAutonomousPlanningPilotTelemetry
  latestPlans: GrowthAutonomousPlanningDecisionSummary[]
  recentRuns: GrowthAutonomousPlanningRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorPlanningSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousPlanningPilotPlanContext = {
  planningAgentOwner: typeof GROWTH_AUTONOMOUS_PLANNING_PILOT_AGENT
  planningStatus: "planned" | "blocked" | "pending" | "not_eligible"
  lastPlannedAt: string | null
  planId: string | null
  confidence: number | null
  executionReadiness: GrowthLeadResearchExecutionPlan["executionReadiness"] | null
  prerequisites: string[]
  requiredApprovals: string[]
  blockedReason: string | null
  wakeRecommendation: string
  revenueOperatorHandoff: string | null
  expectedOutcome: string | null
}
