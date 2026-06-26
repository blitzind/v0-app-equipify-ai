/** GE-AIOS-GROWTH-5G — Autonomous Meeting Agent Pilot types (client-safe). */

import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5G_PHASE = "GE-AIOS-GROWTH-5G" as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER =
  "growth-aios-growth-5g-autonomous-meeting-pilot-v1" as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_RULE =
  "Autonomous Meeting Agent pilot in 5G — Meeting Agent may wake after outreach preparation to prepare meeting briefs under controlled_agent_wake. No calendar writes, booking, invitations, outbound, Work Orders, Opportunities, or Core mutations." as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT = "meeting_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_MEETING_PREPARED_EVENT = "growth.meeting.prepared" as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW = "meeting_preparation" as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_MIN_CONFIDENCE = 0.45 as const

export const GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS = [
  "outreach_preparation_completed",
  "stale_meeting_package",
  "manual_meeting_preparation_request",
] as const

export type GrowthAutonomousMeetingWakeCondition =
  (typeof GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_MEETING_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousMeetingPilotControlState =
  (typeof GROWTH_AUTONOMOUS_MEETING_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET = {
  maxRunsPerHour: 20,
  maxRunsPerDay: 200,
  maxRetriesPerLeadPerDay: 3,
  cooldownAfterFailureMinutes: 30,
} as const

export type GrowthAutonomousMeetingRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousMeetingPreparedAssetSummary = {
  category:
    | "meeting_brief"
    | "account_summary"
    | "decision_maker_summary"
    | "objections"
    | "talking_points"
    | "discovery_questions"
    | "roi_discussion"
    | "recommended_agenda"
    | "follow_up_recommendations"
  label: string
  preview: string
  preparationOnly: true
}

export type GrowthAutonomousMeetingPreparationPackage = {
  packageId: string
  leadId: string
  meetingId: string | null
  companyName: string | null
  preparedAt: string
  generatedAssets: GrowthAutonomousMeetingPreparedAssetSummary[]
  supportingResearch: string[]
  confidence: number
  readinessScore: number | null
  approvalRequirements: string[]
  complianceNotes: string[]
  recommendedAgenda: string
  expectedOutcome: string
  pendingHumanApproval: true
  calendarBlocked: true
  bookingBlocked: true
}

export type GrowthAutonomousMeetingRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousMeetingWakeCondition
  outcome: GrowthAutonomousMeetingRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  packageId: string | null
  meetingId: string | null
  workflowType: string | null
  confidence: number | null
  skipReason: string | null
  blockReason: string | null
  revenueOperatorHandoff: string | null
  preparationPackage: GrowthAutonomousMeetingPreparationPackage | null
}

export type GrowthAutonomousMeetingPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  eligibleLeads: number
  briefsPrepared: number
  preparationPackagesWaiting: number
  blockedPreparations: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  activeRuns: number
}

export type GrowthRevenueOperatorMeetingSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
  latestOutcomeRecommendation: string | null
}

export type GrowthAutonomousMeetingDecisionSummary = {
  leadId: string
  companyName: string | null
  packageId: string
  meetingId: string | null
  preparedAt: string
  confidence: number
  readinessScore: number | null
  assetCount: number
  outcome: GrowthAutonomousMeetingRunOutcome
}

export type GrowthAutonomousMeetingPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousMeetingPilotControlState
  enabled: boolean
  preparationModeOnly: true
  allowedWorkflow: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_ALLOWED_WORKFLOW
  disabledAgentKinds: GrowthAgentKind[]
  budgetLimits: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_BUDGET
  telemetry: GrowthAutonomousMeetingPilotTelemetry
  latestPackages: GrowthAutonomousMeetingDecisionSummary[]
  recentRuns: GrowthAutonomousMeetingRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorMeetingSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousMeetingPilotPlanContext = {
  meetingAgentOwner: typeof GROWTH_AUTONOMOUS_MEETING_PILOT_AGENT
  meetingReadiness: "ready" | "blocked" | "pending" | "not_eligible"
  preparationPackageStatus: "prepared" | "waiting_approval" | "none" | "blocked"
  packageId: string | null
  meetingId: string | null
  preparedAssets: GrowthAutonomousMeetingPreparedAssetSummary[]
  meetingConfidence: number | null
  blockedReason: string | null
  wakeRecommendation: string
  revenueOperatorHandoff: string | null
  recommendedAgenda: string | null
  expectedOutcome: string | null
}

export type AiOsOperationsMeetingAgentStatus = {
  enabled: boolean
  controlState: GrowthAutonomousMeetingPilotControlState
  briefsPrepared: number
  preparationPackagesWaiting: number
  blockedPreparations: number
  eligibleLeads: number
  budgetLabel: string
  latestPreparedAssetSummary: string | null
  lastRunSummary: string | null
  configureHref: string
}
