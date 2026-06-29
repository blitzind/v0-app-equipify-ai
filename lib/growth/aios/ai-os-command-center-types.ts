/** GE-AIOS-5C — AI OS Command Center read model (client-safe). */

import type { AiOsAgentHealthReport } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiOsProviderHealthReport } from "@/lib/growth/aios/ai-provider-health"
import type { AiOsDailyBriefing } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import type { GrowthLeadResearchExecutionPlanQueueItem } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan-review-types"
import type { GrowthLeadResearchApprovedPlanReadinessItem } from "@/lib/growth/aios/growth/growth-lead-research-approved-plan-readiness-types"
import type { GrowthLeadResearchFutureExecutionHandoffContract } from "@/lib/growth/aios/growth/growth-lead-research-future-execution-handoff-types"
import type { GrowthLeadResearchExecutionBoundaryAuditReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-boundary-audit-types"
import type { GrowthLeadResearchExecutionPreflightReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-preflight-types"
import type { GrowthLeadResearchExecutionSimulationReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-simulation-types"
import type { GrowthLeadResearchExecutionRuntimeReadModel } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type { GrowthAgentFrameworkReadModel } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { RevenueOperatorReadModel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthAgentEventsReadModel } from "@/lib/growth/aios/growth/growth-agent-event-types"
import type { GrowthAgentMemoryReadModel } from "@/lib/growth/aios/growth/growth-agent-memory-types"
import type { GrowthMissionFrameworkReadModel } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type { GrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { GrowthSchedulerReadinessReadModel } from "@/lib/growth/aios/growth/growth-scheduler-readiness-types"
import type { GrowthAutonomousOutreachPreparationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthAutonomousMeetingPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"
import type { GrowthAutonomousExecutionPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"
import type { GrowthAutonomousPlanningPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"
import type { GrowthAutonomousQualificationPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"
import type { GrowthAutonomousResearchPilotReadModel } from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"
import type {
  DailyRevenueWorkQueue,
  WorkQueueDisposition,
  WorkQueueItem,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import type { GrowthClosedLoopLearningReadModel } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthAdaptiveCalibrationReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthCalibrationApplyReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import type { GrowthMetaRecommenderReadModel } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthPriorityEngineBindingReadModel } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAiEventBusHealthReadModel } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type { GrowthRevenueDirectorDecisionLedgerReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
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
  executionPlanReviewQueue: GrowthLeadResearchExecutionPlanQueueItem[]
  approvedPlanReadinessQueue: GrowthLeadResearchApprovedPlanReadinessItem[]
  futureExecutionHandoffContracts: GrowthLeadResearchFutureExecutionHandoffContract[]
  executionBoundaryAudit: GrowthLeadResearchExecutionBoundaryAuditReadModel
  executionPreflightChecklist: GrowthLeadResearchExecutionPreflightReadModel
  executionSimulation: GrowthLeadResearchExecutionSimulationReadModel
  executionRuntime: GrowthLeadResearchExecutionRuntimeReadModel
  agentFramework: GrowthAgentFrameworkReadModel
  revenueOperator: RevenueOperatorReadModel
  agentEvents: GrowthAgentEventsReadModel
  agentMemory: GrowthAgentMemoryReadModel
  missionFramework: GrowthMissionFrameworkReadModel
  missionPriority: GrowthMissionPriorityReadModel
  schedulerReadiness: GrowthSchedulerReadinessReadModel
  autonomousResearchPilot: GrowthAutonomousResearchPilotReadModel
  autonomousQualificationPilot: GrowthAutonomousQualificationPilotReadModel
  autonomousPlanningPilot: GrowthAutonomousPlanningPilotReadModel
  autonomousExecutionPilot: GrowthAutonomousExecutionPilotReadModel
  autonomousOutreachPreparationPilot: GrowthAutonomousOutreachPreparationPilotReadModel
  autonomousMeetingPilot: GrowthAutonomousMeetingPilotReadModel
  safeMode: AiOsCommandCenterSafeMode
  metaRecommender: GrowthMetaRecommenderReadModel
  priorityBinding: GrowthPriorityEngineBindingReadModel
  humanApprovalCenter: GrowthHumanApprovalCenterReadModel
  eventBusHealth: GrowthAiEventBusHealthReadModel
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel
  communicationEngine: GrowthCommunicationEngineReadModel
  revenueDirector: GrowthRevenueDirectorReadModel
  revenueDirectorDecisionLedger: GrowthRevenueDirectorDecisionLedgerReadModel
  closedLoopLearning: GrowthClosedLoopLearningReadModel
  adaptiveCalibration: GrowthAdaptiveCalibrationReadModel
  calibrationApply: GrowthCalibrationApplyReadModel
  dailyBriefing: AiOsDailyBriefing
  dailyRevenueWorkQueue: DailyRevenueWorkQueue | null
  dailyRevenueWorkQueueDisplay: DailyRevenueWorkQueueDisplaySummary | null
  operationsDashboard: AiOsOperationsDashboardReadModel
  autonomyPolicy: GrowthAiOsAutonomyPolicyReadModel
}

export const AI_OS_COMMAND_CENTER_RUNTIME_RULE =
  "AI OS Command Center is a read-only operator surface — it never creates Work Orders, invokes providers, sends outbound, or mutates autonomous execution." as const
