/** GE-AIOS-5C — AI OS Command Center read model (client-safe). */

import type { AiOsAgentHealthReport } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiOsProviderHealthReport } from "@/lib/growth/aios/ai-provider-health"
import type { AiOsDailyBriefing } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import type { AiWorkOrderStatus, AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_5C_PHASE = "GE-AIOS-5C" as const

export const GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER = "growth-aios-5c-command-center-v1" as const

export type AiOsCommandCenterAttentionKind =
  | "approval_required"
  | "blocked_work_order"
  | "mission_stalled"
  | "agent_unhealthy"
  | "provider_degraded"
  | "pilot_attention"

export type AiOsCommandCenterAttentionItem = {
  id: string
  kind: AiOsCommandCenterAttentionKind
  title: string
  summary: string
  severity: "high" | "medium" | "low"
  missionId: string | null
  workOrderId: string | null
  leadId: string | null
  href: string | null
}

export type AiOsCommandCenterActiveMission = {
  missionId: string
  title: string
  status: string
  objectiveType: string
  currentStageId: GrowthObjectiveStageId | null
  running: boolean
  progressPercent: number
  activeWorkOrderCount: number
  planningReviewHref: string
}

export type AiOsCommandCenterWorkOrderSummary = {
  workOrderId: string
  missionId: string
  workOrderType: AiWorkOrderType
  status: AiWorkOrderStatus
  assignedAgent: string
  priority: number
  updatedAt: string
  planningReviewHref: string | null
}

export type AiOsCommandCenterDecisionSummary = {
  decisionRecordId: string
  missionId: string
  workOrderId: string | null
  ownerAgent: string
  explanation: string
  confidence: number
  createdAt: string
}

export type AiOsCommandCenterActivityItem = {
  eventId: string
  eventType: string
  category: string
  title: string
  summary: string
  occurredAt: string
  missionId: string | null
  workOrderId: string | null
}

export type AiOsCommandCenterExecutiveBrainActivityItem = {
  eventId: string
  eventType: string
  summary: string
  occurredAt: string
  missionId: string | null
}

export type AiOsCommandCenterPilotStatus = {
  featureEnabled: boolean
  enableAiEvidence: boolean
  activePilotMissions: number
  recentLeadIds: string[]
  observationHrefTemplate: string
}

export type AiOsCommandCenterGrowthLeadResearchLead = {
  leadId: string
  companyName: string | null
  workflowStatus: string
  fitScore: number | null
  opportunityScore: number | null
  recommendation: string | null
  estimatedRevenueRange: string | null
  confidence: number | null
  risk: string | null
  nextBestAction: string | null
  priority: string | null
  workflowType: string | null
  executionReadiness: string | null
  missingPrerequisites: string[]
  estimatedDuration: string | null
  estimatedCost: string | null
  approvalRequired: boolean | null
  recommendedNextAction: string | null
  recommendedWorkOrderType: AiWorkOrderType | null
  observationHref: string
  leadsHref: string
  updatedAt: string
}

export type AiOsCommandCenterGrowthLeadResearchWorkflow = {
  workflowKey: string
  featureEnabled: boolean
  statusCounts: Record<string, number>
  activeLeads: AiOsCommandCenterGrowthLeadResearchLead[]
  assessedLeads: AiOsCommandCenterGrowthLeadResearchLead[]
  qualifiedLeads: AiOsCommandCenterGrowthLeadResearchLead[]
  blockedLeads: AiOsCommandCenterGrowthLeadResearchLead[]
  recommendedNextActions: Array<{
    leadId: string
    companyName: string | null
    action: string
    workOrderType: AiWorkOrderType | null
    reason: string
    priority: string | null
    observationHref: string
  }>
}

export type AiOsCommandCenterSafeMode = {
  emergencyStopActive: boolean
  objectiveModeEnabled: boolean
  autonomyEnabled: boolean
  killSwitches: Record<string, boolean>
}

export type AiOsCommandCenterExecutSummary = {
  headline: string
  activeMissionCount: number
  pendingWorkOrderCount: number
  approvalRequiredCount: number
  blockedWorkOrderCount: number
  recentEventCount: number
  primaryFocus: string | null
}

export type AiOsCommandCenterReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_AI_OS_COMMAND_CENTER_QA_MARKER
  generatedAt: string
  executiveSummary: AiOsCommandCenterExecutSummary
  activeMissions: AiOsCommandCenterActiveMission[]
  needsAttention: AiOsCommandCenterAttentionItem[]
  recentActivity: AiOsCommandCenterActivityItem[]
  executiveBrainActivity: AiOsCommandCenterExecutiveBrainActivityItem[]
  pendingWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  approvalWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  blockedWorkOrders: AiOsCommandCenterWorkOrderSummary[]
  recentDecisionRecords: AiOsCommandCenterDecisionSummary[]
  agentHealth: AiOsAgentHealthReport
  providerHealth: AiOsProviderHealthReport
  pilotStatus: AiOsCommandCenterPilotStatus
  growthLeadResearchWorkflow: AiOsCommandCenterGrowthLeadResearchWorkflow
  safeMode: AiOsCommandCenterSafeMode
  dailyBriefing: AiOsDailyBriefing
}

export const AI_OS_COMMAND_CENTER_RUNTIME_RULE =
  "AI OS Command Center is a read-only operator surface — it never creates Work Orders, invokes providers, sends outbound, or mutates autonomous execution." as const
