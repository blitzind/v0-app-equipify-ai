/** GE-AIOS-CONSOLIDATION-1B — AI Operations dashboard read model (client-safe). */

import type { AiOsDailyBriefing } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { GrowthMissionQueueBucket } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { AiOsOperationsOutreachAgentStatus } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { AiOsOperationsMeetingAgentStatus } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { AiOsOperationsExecutionAgentStatus } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import { GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"

export const GROWTH_AIOS_CONSOLIDATION_1B_PHASE = "GE-AIOS-CONSOLIDATION-1B" as const

export const GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER =
  "growth-aios-consolidation-1b-operations-dashboard-v1" as const

export const AI_OS_OPERATIONS_DASHBOARD_RUNTIME_RULE =
  "AI Operations dashboard is a read-only operator consolidation layer — it synthesizes existing Command Center read models without executing agents, runtime, outbound, providers, Work Orders, or Core mutations." as const

export type AiOsOperationsHealthStatus = "healthy" | "degraded" | "blocked"

export type AiOsOperationsUrgencyLevel = "high" | "medium" | "low"

export type AiOsOperationsRoiLabel = "high" | "medium" | "low" | "unknown"

export type AiOsOperationsActivitySource =
  | "agent_event"
  | "runtime"
  | "autonomous_research"
  | "autonomous_qualification"
  | "autonomous_planning"
  | "autonomous_execution"
  | "autonomous_outreach"
  | "workflow"
  | "revenue_operator"
  | "executive_brain"
  | "command_center"

export type AiOsOperationsAutonomyStateSummary = {
  operatingModeLabel: string
  autonomyEnabled: boolean
  emergencyStopActive: boolean
  safeModeActive: boolean
  shadowModeEnabled: boolean
  activeAutonomousAgents: string[]
  configureHref: string
}

export type AiOsOperationsExecutiveOverview = {
  dailyBriefingHeadline: string
  dailyBriefingSummary: string
  aiHealthStatus: AiOsOperationsHealthStatus
  aiHealthLabel: string
  activeAutonomousRuns: number
  priorityWorkLabel: string | null
  needsAttentionCount: number
  approvalBacklogCount: number
  safeModeLabel: string
  operatingModeLabel: string
  operatingModeReadOnly: true
  configureHref: typeof GROWTH_AI_OS_AUTONOMY_CONTROL_PLANE_PATH
}

export type AiOsOperationsActiveWorkItem = {
  id: string
  category: "mission" | "execution_plan" | "autonomous_research" | "autonomous_qualification" | "autonomous_planning" | "autonomous_execution" | "autonomous_outreach" | "waiting_for_human" | "blocked"
  title: string
  summary: string
  href: string | null
}

export type AiOsOperationsActivityTimelineItem = {
  id: string
  source: AiOsOperationsActivitySource
  title: string
  summary: string
  occurredAt: string
  href: string | null
}

export type AiOsOperationsHealthSummary = {
  overallStatus: AiOsOperationsHealthStatus
  agentHealthLabel: string
  runtimeHealthLabel: string
  queueHealthLabel: string
  schedulerReadinessLabel: string
  budgetUsageLabel: string
  safeModeLabel: string
  blockedAgentsCount: number
}

export type AiOsOperationsApprovalCategory = {
  id: "execution_plans" | "work_orders" | "automation" | "outreach"
  label: string
  count: number
  href: string
}

export type AiOsOperationsApprovalSummary = {
  totalCount: number
  categories: AiOsOperationsApprovalCategory[]
}

export type AiOsOperationsMissionPriorityRow = {
  rank: number
  priorityLabel: string
  ownerAgent: GrowthAgentKind
  missionLabel: string
  roiLabel: AiOsOperationsRoiLabel
  urgency: AiOsOperationsUrgencyLevel
  blockers: string[]
  href: string | null
  queueBucket: GrowthMissionQueueBucket
}

export type AiOsOperationsObjectiveRow = {
  objectiveId: string
  title: string
  progressPercent: number
  aiContributionLabel: string
  stalled: boolean
  completionForecastLabel: string
  href: string
}

export type AiOsOperationsEngineeringDiagnosticSummary = {
  id: string
  label: string
  statusLabel: string
  detail: string
  count: number | null
}

export type AiOsOperationsDashboardReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER
  generatedAt: string
  executiveOverview: AiOsOperationsExecutiveOverview
  autonomyState: AiOsOperationsAutonomyStateSummary
  executionAgentStatus: AiOsOperationsExecutionAgentStatus
  outreachAgentStatus: AiOsOperationsOutreachAgentStatus
  meetingAgentStatus: AiOsOperationsMeetingAgentStatus
  activeWork: AiOsOperationsActiveWorkItem[]
  activityTimeline: AiOsOperationsActivityTimelineItem[]
  healthSummary: AiOsOperationsHealthSummary
  approvalSummary: AiOsOperationsApprovalSummary
  missionPriorities: AiOsOperationsMissionPriorityRow[]
  activeObjectives: AiOsOperationsObjectiveRow[]
  engineeringDiagnostics: AiOsOperationsEngineeringDiagnosticSummary[]
  dailyBriefing: AiOsDailyBriefing
}

export type AiOsOperationsDashboardSupplement = {
  automationApprovalCount: number
}
