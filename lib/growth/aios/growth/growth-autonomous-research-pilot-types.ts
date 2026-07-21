/** GE-AIOS-GROWTH-5B — Autonomous Research Agent Pilot types (client-safe). */

import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5B_PHASE = "GE-AIOS-GROWTH-5B" as const

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER =
  "growth-aios-growth-5b-autonomous-research-pilot-v1" as const

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE =
  "Autonomous Research Agent pilot in 5B — Research Agent may wake under controlled_agent_wake with budget limits to refresh internal research snapshots only. No outbound, providers, runtime, Work Orders, or Core mutations." as const

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT = "research_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS = [
  "stale_research",
  "newly_discovered_lead",
  "manual_refresh_request",
  "scheduled_research_refresh",
] as const

export type GrowthAutonomousResearchWakeCondition =
  (typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousResearchPilotControlState =
  (typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET = {
  maxRunsPerHour: 40,
  maxRunsPerDay: 750,
} as const

export type GrowthAutonomousResearchRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousResearchRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousResearchWakeCondition
  outcome: GrowthAutonomousResearchRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  confidence: number
  skipReason: string | null
  researchSummary: string | null
}

export type GrowthAutonomousResearchPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  averageDurationMs: number
  averageConfidence: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  staleResearchResolved: number
  activeRuns: number
}

export type GrowthRevenueOperatorResearchSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
}

export type GrowthAutonomousResearchRefreshSummary = {
  leadId: string
  companyName: string | null
  refreshedAt: string
  confidence: number
  summary: string
  staleResolved: boolean
}

export type GrowthAutonomousResearchPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousResearchPilotControlState
  enabled: boolean
  otherAgentsDisabled: true
  budgetLimits: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_BUDGET
  telemetry: GrowthAutonomousResearchPilotTelemetry
  latestRefreshes: GrowthAutonomousResearchRefreshSummary[]
  recentRuns: GrowthAutonomousResearchRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorResearchSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_RESEARCH_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousResearchPilotPlanContext = {
  autonomousResearchStatus: GrowthAutonomousResearchPilotControlState
  lastRefreshAt: string | null
  staleStatus: "fresh" | "stale" | "unknown"
  confidence: number | null
  nextScheduledRefresh: string | null
  wakeRecommendation: string
}
