/** GE-AIOS-GROWTH-5C — Autonomous Qualification Agent Pilot types (client-safe). */

import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5C_PHASE = "GE-AIOS-GROWTH-5C" as const

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER =
  "growth-aios-growth-5c-autonomous-qualification-pilot-v1" as const

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE =
  "Autonomous Qualification Agent pilot in 5C — Qualification Agent may wake after successful research to evaluate ICP fit and buying signals under controlled_agent_wake with budget limits. No outbound, providers, runtime, Work Orders, or Core mutations." as const

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT = "qualification_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_QUALIFICATION_COMPLETED_EVENT =
  "growth.qualification.completed" as const

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS = [
  "research_completed",
  "stale_qualification",
  "manual_qualification_request",
] as const

export type GrowthAutonomousQualificationWakeCondition =
  (typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousQualificationPilotControlState =
  (typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET = {
  maxRunsPerHour: 20,
  maxRunsPerDay: 200,
  maxRetriesPerLeadPerDay: 3,
  cooldownAfterFailureMinutes: 30,
} as const

export type GrowthAutonomousQualificationRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousQualificationRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousQualificationWakeCondition
  outcome: GrowthAutonomousQualificationRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  qualificationStatus: "qualified" | "blocked" | "failed" | "skipped" | null
  icpFitScore: number | null
  buyingSignalScore: number | null
  confidence: number | null
  skipReason: string | null
  reasoning: string | null
  missingEvidence: string[]
  recommendedNextStep: string | null
  revenueOperatorHandoff: string | null
}

export type GrowthAutonomousQualificationPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  eligibleLeads: number
  averageDurationMs: number
  averageConfidence: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  activeRuns: number
}

export type GrowthRevenueOperatorQualificationSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
  latestHandoffRecommendation: string | null
}

export type GrowthAutonomousQualificationDecisionSummary = {
  leadId: string
  companyName: string | null
  qualifiedAt: string
  qualificationStatus: "qualified" | "blocked" | "failed"
  icpFitScore: number
  buyingSignalScore: number
  confidence: number
  reasoning: string
  recommendedNextStep: string
}

export type GrowthAutonomousQualificationPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousQualificationPilotControlState
  enabled: boolean
  disabledAgentKinds: GrowthAgentKind[]
  budgetLimits: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_BUDGET
  telemetry: GrowthAutonomousQualificationPilotTelemetry
  latestDecisions: GrowthAutonomousQualificationDecisionSummary[]
  recentRuns: GrowthAutonomousQualificationRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorQualificationSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousQualificationPilotPlanContext = {
  qualificationAgentOwner: typeof GROWTH_AUTONOMOUS_QUALIFICATION_PILOT_AGENT
  qualificationStatus: "qualified" | "blocked" | "failed" | "pending" | "not_eligible"
  lastQualifiedAt: string | null
  confidence: number | null
  icpFitScore: number | null
  buyingSignalScore: number | null
  blockedReason: string | null
  wakeRecommendation: string
  revenueOperatorHandoff: string | null
}
