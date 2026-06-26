/** GE-AIOS-GROWTH-4E — Mission & Goal Planning Framework types (client-safe). */

import type { GrowthAgentKind, GrowthAgentRequiredGate } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type { RevenueOperatorEscalationLevel } from "@/lib/growth/aios/growth/growth-revenue-operator-orchestration-types"

export const GROWTH_AIOS_GROWTH_4E_PHASE = "GE-AIOS-GROWTH-4E" as const

export const GROWTH_MISSION_FRAMEWORK_QA_MARKER = "growth-aios-growth-4e-mission-framework-v1" as const

export const GROWTH_MISSION_FRAMEWORK_RULE =
  "Mission planning is read-only in 4E — the Revenue Operator assigns and tracks business objectives without executing missions, runtime, outbound, providers, Work Orders, or Core mutations." as const

export const GROWTH_MISSION_TYPES = [
  "qualify_lead",
  "enrich_account",
  "identify_buying_committee",
  "prepare_outreach",
  "prepare_meeting",
  "monitor_account",
  "recover_failed_workflow",
  "close_opportunity",
] as const

export type GrowthMissionType = (typeof GROWTH_MISSION_TYPES)[number]

export const GROWTH_MISSION_STATUSES = [
  "proposed",
  "planned",
  "active",
  "blocked",
  "waiting_for_human",
  "completed",
  "abandoned",
] as const

export type GrowthMissionStatus = (typeof GROWTH_MISSION_STATUSES)[number]

export const GROWTH_MISSION_HEALTH_STATES = [
  "healthy",
  "blocked",
  "stalled",
  "waiting",
  "completed",
] as const

export type GrowthMissionHealthState = (typeof GROWTH_MISSION_HEALTH_STATES)[number]

export const GROWTH_MISSION_PRIORITIES = ["low", "normal", "high", "critical"] as const

export type GrowthMissionPriority = (typeof GROWTH_MISSION_PRIORITIES)[number]

export type GrowthMissionDecomposition = {
  primaryAgent: GrowthAgentKind
  supportingAgents: GrowthAgentKind[]
  responsibilities: Array<{
    agentKind: GrowthAgentKind
    responsibility: string
  }>
}

export type GrowthMissionDependencyLink = {
  missionType: GrowthMissionType
  summary: string
}

export type GrowthMissionDependencies = {
  prerequisites: GrowthMissionDependencyLink[]
  blocking: GrowthMissionDependencyLink[]
  optional: GrowthMissionDependencyLink[]
  parallel: GrowthMissionDependencyLink[]
}

export type GrowthMissionHealth = {
  state: GrowthMissionHealthState
  reasoning: string
}

export type GrowthMissionRecord = {
  missionId: string
  missionType: GrowthMissionType
  leadId: string
  companyId: string | null
  companyName: string | null
  objective: string
  priority: GrowthMissionPriority
  ownerAgent: GrowthAgentKind
  supportingAgents: GrowthAgentKind[]
  currentStage: string
  currentStatus: GrowthMissionStatus
  progress: number
  requiredGates: GrowthAgentRequiredGate[]
  completionCriteria: string
  successCriteria: string
  blockedReasons: string[]
  escalationLevel: RevenueOperatorEscalationLevel
  confidence: number | null
  createdAt: string
  lastUpdatedAt: string
  decomposition: GrowthMissionDecomposition
  dependencies: GrowthMissionDependencies
  health: GrowthMissionHealth
  nextRecommendation: string
}

export type GrowthMissionPlannerResult = {
  activeMissions: GrowthMissionRecord[]
  completedMissions: GrowthMissionRecord[]
  stalledMissions: GrowthMissionRecord[]
  recommendedNewMissions: GrowthMissionRecord[]
  recommendedRetiringMissions: GrowthMissionRecord[]
}

export type GrowthMissionPlanContext = {
  missionSummary: string
  currentStage: string
  ownerAgent: GrowthAgentKind
  blockers: string[]
  health: GrowthMissionHealth
  recommendedNextMilestone: string
  primaryMissionType: GrowthMissionType | null
}

export type GrowthMissionFrameworkReadModel = {
  qaMarker: typeof GROWTH_MISSION_FRAMEWORK_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_MISSION_FRAMEWORK_RULE
  schedulerActive: false
  summary: {
    totalMissions: number
    active: number
    blocked: number
    completed: number
    stalled: number
    waitingForHuman: number
  }
  planner: GrowthMissionPlannerResult
  missions: GrowthMissionRecord[]
}

export type GrowthMissionDerivationInput = {
  leadId: string
  companyId?: string | null
  companyName?: string | null
  workflowType?: string | null
  workflowStatus?: string | null
  researchSummary?: string | null
  qualificationSummary?: string | null
  opportunityAssessment?: string | null
  nextBestAction?: string | null
  approvalState?: string | null
  readinessState?: string | null
  runtimeState?: string | null
  dryRunState?: string | null
  owningAgent: GrowthAgentKind
  revenueOperatorRecommendation?: string | null
  blockedReasons?: string[]
  humanReviewRequirements?: string[]
  confidence?: number | null
  completenessState?: string | null
  orchestrationDecision?: string | null
  outboundRecommended?: boolean
  lastUpdatedAt: string
  generatedAt?: string
}
