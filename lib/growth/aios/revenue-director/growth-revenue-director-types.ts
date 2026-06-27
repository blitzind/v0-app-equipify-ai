/** GE-AI-3A — Revenue Director types (client-safe). */

import type { AiOsCommandCenterAttentionItem } from "@/lib/growth/aios/ai-os-command-center-types"
import type { AiOsCommandCenterActiveMission } from "@/lib/growth/aios/ai-os-command-center-types"
import type { AiOsCommandCenterExecutSummary } from "@/lib/growth/aios/ai-os-command-center-types"
import type { AiOsOperationsDashboardReadModel } from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import type { AiOsAgentHealthReport } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAiEventBusHealthReadModel } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-types"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthMetaRecommenderReadModel } from "@/lib/growth/aios/recommendations/growth-meta-recommender-types"
import type { GrowthPriorityEngineBindingReadModel } from "@/lib/growth/aios/priority/growth-priority-engine-binding-types"
import type { GrowthMissionFrameworkReadModel } from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type { GrowthMissionPriorityReadModel } from "@/lib/growth/aios/growth/growth-mission-priority-types"
import type { RevenueOperatorReadModel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"
import type { GrowthAdaptiveCalibrationAdvisoryContext } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthCalibrationVersionAdvisory } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import type { GrowthLearningAdvisoryContext } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

export const GROWTH_AIOS_GE_AI_3A_PHASE = "GE-AI-3A" as const

export const GROWTH_REVENUE_DIRECTOR_QA_MARKER = "growth-ge-ai-3a-revenue-director-v1" as const

export const GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE =
  "Revenue Director is read-only executive orchestration — it coordinates objectives via Command Center projections and advisory workflow requests without sending, executing transport, mutating Core, or bypassing Growth Autonomy or Human Approval." as const

export const GROWTH_REVENUE_DIRECTOR_RANKING_FORMULA =
  "requestPriority = objectiveUrgency * 0.35 + bottleneckSeverity * 0.30 + metaScore * 0.20 + approvalPressure * 0.15 (deterministic tie-break: requestId asc)" as const

/** Single consolidated input — Revenue Director never reads subsystems directly. */
export type GrowthRevenueDirectorCommandCenterSnapshot = {
  generatedAt: string
  executiveSummary: AiOsCommandCenterExecutSummary
  activeMissions: AiOsCommandCenterActiveMission[]
  needsAttention: AiOsCommandCenterAttentionItem[]
  agentHealth: AiOsAgentHealthReport
  missionFramework: GrowthMissionFrameworkReadModel
  missionPriority: GrowthMissionPriorityReadModel
  revenueOperator: RevenueOperatorReadModel
  metaRecommender: GrowthMetaRecommenderReadModel
  priorityBinding: GrowthPriorityEngineBindingReadModel
  humanApprovalCenter: GrowthHumanApprovalCenterReadModel
  communicationEngine: GrowthCommunicationEngineReadModel
  boundedAutonomousOutbound: GrowthBoundedAutonomousOutboundReadModel
  eventBusHealth: GrowthAiEventBusHealthReadModel
  autonomyPolicy: GrowthAiOsAutonomyPolicyReadModel
  operationsDashboard: AiOsOperationsDashboardReadModel
}

export const GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_TYPES = [
  "run_research",
  "rerun_qualification",
  "generate_outreach",
  "wait",
  "escalate_human",
  "pause_objective",
  "allocate_more_budget",
  "request_communication_plan",
  "review_approval_queue",
] as const

export type GrowthRevenueDirectorWorkflowRequestType =
  (typeof GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_TYPES)[number]

export const GROWTH_REVENUE_DIRECTOR_REVENUE_HEALTH = [
  "on_pace",
  "at_risk",
  "blocked",
  "degraded",
] as const

export type GrowthRevenueDirectorRevenueHealth =
  (typeof GROWTH_REVENUE_DIRECTOR_REVENUE_HEALTH)[number]

export const GROWTH_REVENUE_DIRECTOR_OBJECTIVE_PACE = [
  "on_pace",
  "behind",
  "blocked",
  "waiting",
  "completed",
] as const

export type GrowthRevenueDirectorObjectivePace =
  (typeof GROWTH_REVENUE_DIRECTOR_OBJECTIVE_PACE)[number]

export type GrowthRevenueDirectorWorkflowRequest = {
  id: string
  requestType: GrowthRevenueDirectorWorkflowRequestType
  advisory: true
  title: string
  summary: string
  objectiveId?: string
  leadId?: string
  missionId?: string
  targetWorkflowAgent: string
  priorityScore: number
  requiresHumanApproval: boolean
  evidence: Array<{ source: string; label: string; value?: string | number | boolean }>
  routeHint?: string
  ledgerStatus?: import("@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types").GrowthRevenueDirectorLedgerWorkflowVisibility
  ledgerRequestId?: string
  isStale?: boolean
  dispatchEligibility?: import("@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-types").GrowthRevenueDirectorDispatchEligibility
  correlationStatus?: import("@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types").GrowthRevenueDirectorDispatchCorrelationStatus
  correlationResultReference?: import("@/lib/growth/aios/revenue-director/growth-revenue-director-dispatch-correlation-types").GrowthRevenueDirectorDispatchCorrelationResultReference
  correlationFailureReason?: string | null
}

export type GrowthRevenueDirectorDecisionLedgerSummary = {
  readOnly: true
  schemaReady: boolean
  summary: import("@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types").GrowthRevenueDirectorDecisionLedgerReadModel["summary"]
  pendingDecisions: number
  pendingRequests: number
  acceptedRequests: number
  completedCount: number
  supersededCount: number
}

export type GrowthRevenueDirectorObjectiveHealth = {
  objectiveId: string
  title: string
  pace: GrowthRevenueDirectorObjectivePace
  blockerCount: number
  priorityRank: number | null
  recommendedAgent: string | null
}

export type GrowthRevenueDirectorKpiSnapshot = {
  approvalBacklog: number
  activeAutonomousScopes: number
  blockedAutonomousScopes: number
  activeMissions: number
  stalledMissions: number
  humanReviewRequired: number
  communicationPlansGenerated: number
  eventBusHealthy: boolean
}

export type GrowthRevenueDirectorResourceAllocation = {
  topObjectiveId: string | null
  topObjectiveTitle: string | null
  starvedBindingCount: number
  outboundActionsToday: number
  outboundDailyLimit: number | null
  communicationTopChannel: string | null
}

export type GrowthRevenueDirectorBottleneck = {
  id: string
  label: string
  severity: "low" | "medium" | "high"
  source: string
  summary: string
}

export type GrowthRevenueDirectorRisk = {
  id: string
  label: string
  severity: "low" | "medium" | "high"
  summary: string
  mitigation: string
}

export type GrowthRevenueDirectorEscalation = {
  id: string
  title: string
  summary: string
  route?: string
  severity: "medium" | "high"
}

export type GrowthRevenueDirectorExecutiveSummary = {
  revenueHealth: GrowthRevenueDirectorRevenueHealth
  onPace: boolean
  primaryFocus: string | null
  headline: string
  shouldPauseOutbound: boolean
  shouldIntervene: boolean
}

export type GrowthRevenueDirectorReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_REVENUE_DIRECTOR_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE
  rankingFormula: typeof GROWTH_REVENUE_DIRECTOR_RANKING_FORMULA
  executiveSummary: GrowthRevenueDirectorExecutiveSummary
  objectiveHealth: GrowthRevenueDirectorObjectiveHealth[]
  kpis: GrowthRevenueDirectorKpiSnapshot
  resourceAllocation: GrowthRevenueDirectorResourceAllocation
  workflowRequests: GrowthRevenueDirectorWorkflowRequest[]
  bottlenecks: GrowthRevenueDirectorBottleneck[]
  risks: GrowthRevenueDirectorRisk[]
  escalations: GrowthRevenueDirectorEscalation[]
  recommendations: Array<{ id: string; title: string; summary: string; source: string }>
  health: {
    agentHealthStatus: "healthy" | "degraded" | "unhealthy"
    eventBusStatus: "healthy" | "degraded" | "unhealthy"
    autonomyStatus: "enabled" | "restricted" | "stopped"
  }
  eventObservation: {
    subscriberId: "revenue_director_observer"
    eventsReceived: number
    lastEventType: string | null
  }
  decisionLedger?: GrowthRevenueDirectorDecisionLedgerSummary
  learningAdvisory?: GrowthLearningAdvisoryContext
  calibrationAdvisory?: GrowthAdaptiveCalibrationAdvisoryContext
  calibrationVersionAdvisory?: GrowthCalibrationVersionAdvisory
}

export const GROWTH_REVENUE_DIRECTOR_EVENT_TYPES = {
  snapshotGenerated: "growth.revenue_director.snapshot_generated",
} as const
