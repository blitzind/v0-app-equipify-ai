/** GE-AIOS-GROWTH-4F — Mission Prioritization & Resource Allocation types (client-safe). */

import type { GrowthAgentKind } from "@/lib/growth/aios/growth/growth-agent-framework-types"
import type {
  GrowthMissionRecord,
  GrowthMissionType,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"

export const GROWTH_AIOS_GROWTH_4F_PHASE = "GE-AIOS-GROWTH-4F" as const

export const GROWTH_MISSION_PRIORITY_QA_MARKER = "growth-aios-growth-4f-mission-priority-v1" as const

export const GROWTH_MISSION_PRIORITY_RULE =
  "Mission prioritization is read-only in 4F — the Revenue Operator ranks missions and allocates conceptual AI capacity without executing missions, activating schedulers, runtime, outbound, providers, Work Orders, or Core mutations." as const

export const GROWTH_MISSION_CAPACITY_KINDS = [
  "research_capacity",
  "qualification_capacity",
  "planning_capacity",
  "execution_capacity",
  "meeting_preparation_capacity",
  "revenue_operator_review_capacity",
] as const

export type GrowthMissionCapacityKind = (typeof GROWTH_MISSION_CAPACITY_KINDS)[number]

export const GROWTH_MISSION_QUEUE_BUCKETS = [
  "immediate",
  "today",
  "this_week",
  "backlog",
  "archive_candidate",
] as const

export type GrowthMissionQueueBucket = (typeof GROWTH_MISSION_QUEUE_BUCKETS)[number]

export const GROWTH_MISSION_STARVATION_KINDS = [
  "long_waiting",
  "repeatedly_blocked",
  "duplicate_mission",
  "conflicting_missions",
  "stale_mission",
] as const

export type GrowthMissionStarvationKind = (typeof GROWTH_MISSION_STARVATION_KINDS)[number]

export type GrowthMissionPriorityScores = {
  priorityScore: number
  urgencyScore: number
  businessValueScore: number
  confidenceScore: number
  effortScore: number
  estimatedRoi: number
  missionAgeDays: number
  slaPressure: number
  dependencyWeight: number
  strategicImportance: number
  overallPriority: number
  explanation: string
  recommendedOrder: number
}

export type GrowthResourceCapacitySlot = {
  capacityKind: GrowthMissionCapacityKind
  label: string
  totalSlots: number
  allocatedSlots: number
  availableSlots: number
  schedulerActive: false
}

export type GrowthMissionAllocationRecommendation = {
  missionId: string
  missionType: GrowthMissionType
  leadId: string
  companyName: string | null
  capacityKind: GrowthMissionCapacityKind
  allocationStatus:
    | "allocated"
    | "deferred"
    | "blocked"
    | "abandon_recommended"
    | "waiting_for_human"
    | "waiting_for_prerequisite"
  queueBucket: GrowthMissionQueueBucket
  priority: GrowthMissionPriorityScores
  blockers: string[]
  recommendedAction: string
  deferReason: string | null
  allocationReason: string
}

export type GrowthMissionQueueBuckets = Record<GrowthMissionQueueBucket, GrowthMissionAllocationRecommendation[]>

export type GrowthMissionStarvationIssue = {
  issueId: string
  kind: GrowthMissionStarvationKind
  missionId: string
  leadId: string
  summary: string
  recommendedRemediation: string
}

export type GrowthRevenueOperatorCapacityGuidance = {
  highestValueWork: string
  shouldHappenToday: string
  canSafelyWait: string
  shouldAbandon: string
  capacitySpend: string
}

export type GrowthMissionPriorityReadModel = {
  qaMarker: typeof GROWTH_MISSION_PRIORITY_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_MISSION_PRIORITY_RULE
  schedulerActive: false
  summary: {
    missionsRanked: number
    immediate: number
    today: number
    deferred: number
    blocked: number
    abandonRecommended: number
    starvationIssues: number
  }
  capacityPool: GrowthResourceCapacitySlot[]
  rankedMissions: GrowthMissionAllocationRecommendation[]
  queues: GrowthMissionQueueBuckets
  starvationIssues: GrowthMissionStarvationIssue[]
  revenueOperatorGuidance: GrowthRevenueOperatorCapacityGuidance
}

export type GrowthMissionPriorityPlanContext = {
  missionPriority: GrowthMissionPriorityScores
  queueBucket: GrowthMissionQueueBucket
  allocationReason: string
  deferReason: string | null
  estimatedRoi: number
  urgencyScore: number
  recommendedAction: string
}

export type GrowthMissionPriorityInput = {
  missions: GrowthMissionRecord[]
  generatedAt: string
}
