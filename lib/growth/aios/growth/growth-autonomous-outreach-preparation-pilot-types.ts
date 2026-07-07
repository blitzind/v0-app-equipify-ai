/** GE-AIOS-GROWTH-5F — Autonomous Outreach Preparation Agent Pilot types (client-safe). */

import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthSchedulerMode } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"

export const GROWTH_AIOS_GROWTH_5F_PHASE = "GE-AIOS-GROWTH-5F" as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER =
  "growth-aios-growth-5f-autonomous-outreach-preparation-pilot-v1" as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE =
  "Autonomous Outreach Preparation Agent pilot in 5F — Outreach Agent may wake after successful internal execution to prepare draft-only outreach assets under controlled_agent_wake. No transport, SENDR enrollment, campaigns, providers for delivery, Work Orders, or Core mutations." as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT = "outreach_agent" as const satisfies GrowthAgentKind

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE =
  "controlled_agent_wake" as const satisfies GrowthSchedulerMode

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARED_EVENT = "growth.outreach.prepared" as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW = "outreach_generation" as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_MIN_CONFIDENCE = 0.45 as const

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS = [
  "execution_completed",
  "stale_outreach_package",
  "manual_outreach_preparation_request",
] as const

export type GrowthAutonomousOutreachPreparationWakeCondition =
  (typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS)[number]

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_CONTROL_STATES = [
  "active",
  "paused",
  "disabled",
] as const

export type GrowthAutonomousOutreachPreparationPilotControlState =
  (typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_CONTROL_STATES)[number]

export const GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET = {
  maxRunsPerHour: 20,
  maxRunsPerDay: 200,
  maxRetriesPerLeadPerDay: 3,
  cooldownAfterFailureMinutes: 30,
} as const

export type GrowthAutonomousOutreachPreparationRunOutcome = "completed" | "failed" | "skipped"

export type GrowthAutonomousOutreachPreparedAssetSummary = {
  channel: "email" | "sms" | "linkedin" | "call" | "sendr" | "follow_up"
  label: string
  preview: string
  draftOnly: true
}

export type GrowthAutonomousOutreachApprovalPackage = {
  packageId: string
  leadId: string
  companyName: string | null
  preparedAt: string
  generatedAssets: GrowthAutonomousOutreachPreparedAssetSummary[]
  personalizationEvidence: string[]
  supportingResearch: string[]
  confidence: number
  approvalRequirements: string[]
  complianceNotes: string[]
  recommendedChannel: string
  recommendedSequence: string
  expectedOutcome: string
  pendingHumanApproval: true
  transportBlocked: true
  /** GE-AVA-AUTONOMY-EXECUTION-REQUEST-1 — set after operator package approval */
  packageApprovalDecision?: "approved" | "rejected" | null
  executionRequestId?: string | null
}

export type GrowthAutonomousOutreachPreparationRunRecord = {
  runId: string
  leadId: string
  companyName: string | null
  wakeCondition: GrowthAutonomousOutreachPreparationWakeCondition
  outcome: GrowthAutonomousOutreachPreparationRunOutcome
  startedAt: string
  completedAt: string
  durationMs: number
  packageId: string | null
  workflowType: string | null
  confidence: number | null
  skipReason: string | null
  blockReason: string | null
  revenueOperatorHandoff: string | null
  approvalPackage: GrowthAutonomousOutreachApprovalPackage | null
}

export type GrowthAutonomousOutreachPreparationPilotTelemetry = {
  successfulRuns: number
  failedRuns: number
  skippedRuns: number
  eligibleLeads: number
  draftsPrepared: number
  approvalPackagesWaiting: number
  blockedPreparations: number
  budgetConsumptionHour: number
  budgetConsumptionDay: number
  activeRuns: number
}

export type GrowthRevenueOperatorOutreachPreparationSupervision = {
  approveWakeRecommendation: string
  budgetMonitorSummary: string
  failureMonitorSummary: string
  pauseRecommendation: string | null
  escalationRecommendation: string | null
  latestOutcomeRecommendation: string | null
}

export type GrowthAutonomousOutreachPreparationDecisionSummary = {
  leadId: string
  companyName: string | null
  packageId: string
  preparedAt: string
  confidence: number
  recommendedChannel: string
  assetCount: number
  outcome: GrowthAutonomousOutreachPreparationRunOutcome
}

export type GrowthAutonomousOutreachPreparationPilotReadModel = {
  qaMarker: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_RULE
  agentKind: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT
  schedulerMode: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_SCHEDULER_MODE
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  enabled: boolean
  preparationModeOnly: true
  allowedWorkflow: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_ALLOWED_WORKFLOW
  disabledAgentKinds: GrowthAgentKind[]
  budgetLimits: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_BUDGET
  telemetry: GrowthAutonomousOutreachPreparationPilotTelemetry
  latestPackages: GrowthAutonomousOutreachPreparationDecisionSummary[]
  recentRuns: GrowthAutonomousOutreachPreparationRunRecord[]
  revenueOperatorSupervision: GrowthRevenueOperatorOutreachPreparationSupervision
  wakeConditionsSupported: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_WAKE_CONDITIONS
  policyDerived?: boolean
  configureHref?: string
  autonomyPolicySource?: string
}

export type GrowthAutonomousOutreachPreparationPilotPlanContext = {
  outreachAgentOwner: typeof GROWTH_AUTONOMOUS_OUTREACH_PREPARATION_PILOT_AGENT
  outreachReadiness: "ready" | "blocked" | "pending" | "not_eligible"
  approvalPackageStatus: "prepared" | "waiting_approval" | "none" | "blocked"
  packageId: string | null
  preparedAssets: GrowthAutonomousOutreachPreparedAssetSummary[]
  personalizationConfidence: number | null
  blockedReason: string | null
  wakeRecommendation: string
  revenueOperatorHandoff: string | null
  recommendedChannel: string | null
  expectedOutcome: string | null
}

export type AiOsOperationsOutreachAgentStatus = {
  enabled: boolean
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  draftsPrepared: number
  approvalPackagesWaiting: number
  blockedPreparations: number
  eligibleLeads: number
  budgetLabel: string
  latestPreparedAssetSummary: string | null
  configureHref: string
}
