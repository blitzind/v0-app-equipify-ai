/** GE-AIOS-GROWTH-4F — Mission Prioritization & Allocation engine (client-safe, deterministic). */

import { isAgentSchedulerActive } from "@/lib/growth/aios/growth/growth-agent-framework-permissions"
import type {
  GrowthMissionRecord,
  GrowthMissionType,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"
import type {
  GrowthMissionAllocationRecommendation,
  GrowthMissionCapacityKind,
  GrowthMissionPriorityInput,
  GrowthMissionPriorityPlanContext,
  GrowthMissionPriorityReadModel,
  GrowthMissionPriorityScores,
  GrowthMissionQueueBucket,
  GrowthMissionQueueBuckets,
  GrowthMissionStarvationIssue,
  GrowthResourceCapacitySlot,
  GrowthRevenueOperatorCapacityGuidance,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"
import {
  GROWTH_MISSION_CAPACITY_KINDS,
  GROWTH_MISSION_PRIORITY_QA_MARKER,
  GROWTH_MISSION_PRIORITY_RULE,
  GROWTH_MISSION_QUEUE_BUCKETS,
} from "@/lib/growth/aios/growth/growth-mission-priority-types"

const CAPACITY_LABELS: Record<GrowthMissionCapacityKind, string> = {
  research_capacity: "Research capacity",
  qualification_capacity: "Qualification capacity",
  planning_capacity: "Planning capacity",
  execution_capacity: "Execution capacity",
  meeting_preparation_capacity: "Meeting preparation capacity",
  revenue_operator_review_capacity: "Revenue Operator review capacity",
}

const DEFAULT_CAPACITY_SLOTS: Record<GrowthMissionCapacityKind, number> = {
  research_capacity: 3,
  qualification_capacity: 3,
  planning_capacity: 2,
  execution_capacity: 2,
  meeting_preparation_capacity: 2,
  revenue_operator_review_capacity: 4,
}

const STRATEGIC_IMPORTANCE: Record<GrowthMissionType, number> = {
  qualify_lead: 72,
  enrich_account: 55,
  identify_buying_committee: 68,
  prepare_outreach: 40,
  prepare_meeting: 78,
  monitor_account: 35,
  recover_failed_workflow: 88,
  close_opportunity: 50,
}

const EFFORT_SCORE: Record<GrowthMissionType, number> = {
  qualify_lead: 45,
  enrich_account: 35,
  identify_buying_committee: 55,
  prepare_outreach: 60,
  prepare_meeting: 40,
  monitor_account: 25,
  recover_failed_workflow: 70,
  close_opportunity: 30,
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function missionAgeDays(mission: GrowthMissionRecord, generatedAt: string): number {
  const updated = Date.parse(mission.lastUpdatedAt)
  const now = Date.parse(generatedAt)
  if (!Number.isFinite(updated) || !Number.isFinite(now)) return 0
  return Math.max(0, Math.round((now - updated) / (1000 * 60 * 60 * 24)))
}

function resolveCapacityKind(mission: GrowthMissionRecord): GrowthMissionCapacityKind {
  switch (mission.missionType) {
    case "enrich_account":
    case "monitor_account":
      return "research_capacity"
    case "qualify_lead":
    case "identify_buying_committee":
      return "qualification_capacity"
    case "prepare_outreach":
      return "planning_capacity"
    case "recover_failed_workflow":
      return mission.ownerAgent === "execution_agent" ? "execution_capacity" : "revenue_operator_review_capacity"
    case "prepare_meeting":
      return "meeting_preparation_capacity"
    case "close_opportunity":
      return "revenue_operator_review_capacity"
    default:
      return "planning_capacity"
  }
}

function businessValueScore(mission: GrowthMissionRecord): number {
  let score = STRATEGIC_IMPORTANCE[mission.missionType]
  if (mission.currentStatus === "active") score += 12
  if (mission.missionType === "recover_failed_workflow") score += 10
  if (mission.missionType === "prepare_outreach") score -= 25
  return clampScore(score)
}

function urgencyScore(mission: GrowthMissionRecord, ageDays: number): number {
  let score = 40
  if (mission.priority === "critical") score += 35
  if (mission.priority === "high") score += 22
  if (mission.escalationLevel === "high" || mission.escalationLevel === "critical") score += 20
  if (mission.currentStatus === "waiting_for_human") score += 18
  if (mission.health.state === "stalled") score += 15
  if (ageDays > 7) score += Math.min(20, ageDays)
  return clampScore(score)
}

export function scoreMissionPriority(
  mission: GrowthMissionRecord,
  input: { generatedAt: string; dependencyWeight?: number },
): GrowthMissionPriorityScores {
  const ageDays = missionAgeDays(mission, input.generatedAt)
  const businessValue = businessValueScore(mission)
  const urgency = urgencyScore(mission, ageDays)
  const confidenceScore = clampScore((mission.confidence ?? 0.5) * 100)
  const effortScore = clampScore(EFFORT_SCORE[mission.missionType] + (1 - mission.progress) * 20)
  const estimatedRoi = clampScore(businessValue / Math.max(1, effortScore / 20))
  const dependencyWeight = input.dependencyWeight ?? clampScore(mission.dependencies.prerequisites.length * 15)
  const strategicImportance = STRATEGIC_IMPORTANCE[mission.missionType]
  const slaPressure = clampScore(ageDays * 4 + (mission.health.state === "stalled" ? 25 : 0))

  const priorityScore = clampScore(
    businessValue * 0.28 +
      urgency * 0.22 +
      confidenceScore * 0.15 +
      estimatedRoi * 0.15 +
      strategicImportance * 0.1 +
      slaPressure * 0.05 +
      dependencyWeight * 0.05 -
      effortScore * 0.1,
  )

  const overallPriority = priorityScore

  return {
    priorityScore,
    urgencyScore: urgency,
    businessValueScore: businessValue,
    confidenceScore,
    effortScore,
    estimatedRoi,
    missionAgeDays: ageDays,
    slaPressure,
    dependencyWeight,
    strategicImportance,
    overallPriority,
    explanation: `Priority ${overallPriority} — value ${businessValue}, urgency ${urgency}, ROI ${estimatedRoi}, confidence ${confidenceScore}.`,
    recommendedOrder: 0,
  }
}

export function buildConceptualCapacityPool(
  allocations: GrowthMissionAllocationRecommendation[],
): GrowthResourceCapacitySlot[] {
  const allocated = new Map<GrowthMissionCapacityKind, number>()
  for (const row of allocations) {
    if (row.allocationStatus === "allocated") {
      allocated.set(row.capacityKind, (allocated.get(row.capacityKind) ?? 0) + 1)
    }
  }

  return GROWTH_MISSION_CAPACITY_KINDS.map((capacityKind) => {
    const totalSlots = DEFAULT_CAPACITY_SLOTS[capacityKind]
    const allocatedSlots = allocated.get(capacityKind) ?? 0
    return {
      capacityKind,
      label: CAPACITY_LABELS[capacityKind],
      totalSlots,
      allocatedSlots,
      availableSlots: Math.max(0, totalSlots - allocatedSlots),
      schedulerActive: false as const,
    }
  })
}

function resolveQueueBucket(
  mission: GrowthMissionRecord,
  priority: GrowthMissionPriorityScores,
  allocationStatus: GrowthMissionAllocationRecommendation["allocationStatus"],
): GrowthMissionQueueBucket {
  if (
    allocationStatus === "abandon_recommended" ||
    mission.currentStatus === "completed" ||
    mission.currentStatus === "abandoned"
  ) {
    return "archive_candidate"
  }
  if (allocationStatus === "deferred" || priority.overallPriority < 40) return "backlog"
  if (priority.overallPriority >= 80 && allocationStatus === "allocated") return "immediate"
  if (priority.overallPriority >= 55) return "today"
  if (priority.overallPriority >= 40) return "this_week"
  return "backlog"
}

function resolveAllocationStatus(input: {
  mission: GrowthMissionRecord
  priority: GrowthMissionPriorityScores
  capacityAvailable: boolean
}): {
  status: GrowthMissionAllocationRecommendation["allocationStatus"]
  deferReason: string | null
  allocationReason: string
} {
  const { mission, priority, capacityAvailable } = input

  if (mission.currentStatus === "completed") {
    return {
      status: "abandon_recommended",
      deferReason: null,
      allocationReason: "Mission completed — archive candidate.",
    }
  }

  if (mission.currentStatus === "waiting_for_human") {
    return {
      status: "waiting_for_human",
      deferReason: "Operator review required.",
      allocationReason: "Capacity reserved for human review gate.",
    }
  }

  if (mission.dependencies.prerequisites.length > 0 && mission.progress < 0.35) {
    return {
      status: "waiting_for_prerequisite",
      deferReason: "Prerequisite missions incomplete.",
      allocationReason: "Defer until prerequisites satisfy dependency graph.",
    }
  }

  if (mission.currentStatus === "blocked" || mission.health.state === "blocked") {
    return {
      status: "blocked",
      deferReason: mission.blockedReasons[0] ?? "Mission blocked.",
      allocationReason: "Blocked missions do not receive capacity.",
    }
  }

  if (
    mission.missionType === "prepare_outreach" ||
    (mission.missionType === "monitor_account" && priority.overallPriority < 30)
  ) {
    return {
      status: "abandon_recommended",
      deferReason: "Low ROI or outbound blocked.",
      allocationReason: "Recommend retire or archive — no capacity spend in 4F.",
    }
  }

  if (!capacityAvailable) {
    return {
      status: "deferred",
      deferReason: "Conceptual capacity exhausted for this lane.",
      allocationReason: "Defer to next planning cycle — recommendation only.",
    }
  }

  return {
    status: "allocated",
    deferReason: null,
    allocationReason: `Allocate ${CAPACITY_LABELS[resolveCapacityKind(mission)]} — priority ${priority.overallPriority}.`,
  }
}

export function buildMissionAllocationRecommendation(input: {
  mission: GrowthMissionRecord
  priority: GrowthMissionPriorityScores
  capacityAvailable: boolean
}): GrowthMissionAllocationRecommendation {
  const capacityKind = resolveCapacityKind(input.mission)
  const allocation = resolveAllocationStatus(input)
  const queueBucket = resolveQueueBucket(input.mission, input.priority, allocation.status)

  return {
    missionId: input.mission.missionId,
    missionType: input.mission.missionType,
    leadId: input.mission.leadId,
    companyName: input.mission.companyName,
    capacityKind,
    allocationStatus: allocation.status,
    queueBucket,
    priority: input.priority,
    blockers: input.mission.blockedReasons,
    recommendedAction: input.mission.nextRecommendation,
    deferReason: allocation.deferReason,
    allocationReason: allocation.allocationReason,
  }
}

export function buildMissionQueueBuckets(
  allocations: GrowthMissionAllocationRecommendation[],
): GrowthMissionQueueBuckets {
  const buckets = Object.fromEntries(
    GROWTH_MISSION_QUEUE_BUCKETS.map((bucket) => [bucket, [] as GrowthMissionAllocationRecommendation[]]),
  ) as GrowthMissionQueueBuckets

  for (const row of allocations) {
    buckets[row.queueBucket].push(row)
  }

  for (const bucket of GROWTH_MISSION_QUEUE_BUCKETS) {
    buckets[bucket].sort((a, b) => b.priority.overallPriority - a.priority.overallPriority)
  }

  return buckets
}

export function detectMissionStarvation(input: {
  missions: GrowthMissionRecord[]
  allocations: GrowthMissionAllocationRecommendation[]
  generatedAt: string
}): GrowthMissionStarvationIssue[] {
  const issues: GrowthMissionStarvationIssue[] = []
  const seen = new Map<string, string>()

  for (const mission of input.missions) {
    const ageDays = missionAgeDays(mission, input.generatedAt)
    const key = `${mission.leadId}:${mission.missionType}`

    if (seen.has(key)) {
      issues.push({
        issueId: `starvation:duplicate:${mission.missionId}`,
        kind: "duplicate_mission",
        missionId: mission.missionId,
        leadId: mission.leadId,
        summary: `Duplicate ${mission.missionType.replaceAll("_", " ")} mission for lead.`,
        recommendedRemediation: "Retire duplicate mission and consolidate context.",
      })
    } else {
      seen.set(key, mission.missionId)
    }

    if (ageDays > 14 && mission.progress < 0.35) {
      issues.push({
        issueId: `starvation:long_wait:${mission.missionId}`,
        kind: "long_waiting",
        missionId: mission.missionId,
        leadId: mission.leadId,
        summary: `Mission waiting ${ageDays} days with low progress.`,
        recommendedRemediation: "Reprioritize or abandon stale mission.",
      })
    }

    if (mission.currentStatus === "blocked" && mission.blockedReasons.length > 1) {
      issues.push({
        issueId: `starvation:blocked:${mission.missionId}`,
        kind: "repeatedly_blocked",
        missionId: mission.missionId,
        leadId: mission.leadId,
        summary: "Mission repeatedly blocked by guardrails.",
        recommendedRemediation: "Resolve blockers or recommend abandon.",
      })
    }

    if (mission.health.state === "stalled" && ageDays > 7) {
      issues.push({
        issueId: `starvation:stale:${mission.missionId}`,
        kind: "stale_mission",
        missionId: mission.missionId,
        leadId: mission.leadId,
        summary: "Stale mission with stalled health.",
        recommendedRemediation: "Move to backlog or archive candidate queue.",
      })
    }
  }

  const activeByLead = new Map<string, GrowthMissionRecord[]>() 
  for (const mission of input.missions.filter((m) => m.currentStatus === "active" || m.currentStatus === "planned")) {
    const rows = activeByLead.get(mission.leadId) ?? []
    rows.push(mission)
    activeByLead.set(mission.leadId, rows)
  }

  for (const [leadId, rows] of activeByLead) {
    if (rows.length > 2) {
      issues.push({
        issueId: `starvation:conflict:${leadId}`,
        kind: "conflicting_missions",
        missionId: rows[0]?.missionId ?? leadId,
        leadId,
        summary: `${rows.length} concurrent active missions may conflict.`,
        recommendedRemediation: "Revenue Operator should retire lower-value missions.",
      })
    }
  }

  return issues
}

export function buildRevenueOperatorCapacityGuidance(input: {
  allocations: GrowthMissionAllocationRecommendation[]
  queues: GrowthMissionQueueBuckets
  capacityPool: GrowthResourceCapacitySlot[]
}): GrowthRevenueOperatorCapacityGuidance {
  const ranked = [...input.allocations].sort(
    (a, b) => b.priority.overallPriority - a.priority.overallPriority,
  )
  const top = ranked[0]
  const today = input.queues.today[0] ?? input.queues.immediate[0]
  const defer = input.allocations.find((row) => row.allocationStatus === "deferred")
  const abandon = input.allocations.find((row) => row.allocationStatus === "abandon_recommended")
  const topCapacity = [...input.capacityPool].sort((a, b) => b.allocatedSlots - a.allocatedSlots)[0]

  return {
    highestValueWork: top
      ? `${top.companyName ?? top.leadId} — ${top.missionType.replaceAll("_", " ")} (priority ${top.priority.overallPriority})`
      : "No missions ranked yet.",
    shouldHappenToday: today
      ? `${today.companyName ?? today.leadId} — ${today.recommendedAction}`
      : "Focus on immediate queue missions first.",
    canSafelyWait: defer
      ? `${defer.companyName ?? defer.leadId} — ${defer.deferReason ?? "Deferred by capacity."}`
      : "Backlog missions can wait until capacity frees.",
    shouldAbandon: abandon
      ? `${abandon.companyName ?? abandon.leadId} — ${abandon.allocationReason}`
      : "No abandon recommendations.",
    capacitySpend: topCapacity
      ? `Spend conceptual capacity on ${topCapacity.label} (${topCapacity.allocatedSlots}/${topCapacity.totalSlots} slots).`
      : "Capacity pool unused — review mission intake.",
  }
}

export function prioritizeAndAllocateMissions(input: GrowthMissionPriorityInput): {
  rankedMissions: GrowthMissionAllocationRecommendation[]
  queues: GrowthMissionQueueBuckets
  capacityPool: GrowthResourceCapacitySlot[]
  starvationIssues: GrowthMissionStarvationIssue[]
  revenueOperatorGuidance: GrowthRevenueOperatorCapacityGuidance
} {
  const scored = input.missions
    .filter((m) => m.currentStatus !== "abandoned")
    .map((mission) => ({
      mission,
      priority: scoreMissionPriority(mission, {
        generatedAt: input.generatedAt,
        dependencyWeight: clampScore(mission.dependencies.prerequisites.length * 12),
      }),
    }))
    .sort((a, b) => b.priority.overallPriority - a.priority.overallPriority)

  scored.forEach((row, index) => {
    row.priority.recommendedOrder = index + 1
  })

  const capacityRemaining = new Map<GrowthMissionCapacityKind, number>(
    Object.entries(DEFAULT_CAPACITY_SLOTS) as [GrowthMissionCapacityKind, number][],
  )

  const rankedMissions = scored.map(({ mission, priority }) => {
    const capacityKind = resolveCapacityKind(mission)
    const available = (capacityRemaining.get(capacityKind) ?? 0) > 0
    const allocation = buildMissionAllocationRecommendation({
      mission,
      priority,
      capacityAvailable: available,
    })
    if (allocation.allocationStatus === "allocated") {
      capacityRemaining.set(capacityKind, Math.max(0, (capacityRemaining.get(capacityKind) ?? 0) - 1))
    }
    return allocation
  })

  const queues = buildMissionQueueBuckets(rankedMissions)
  const capacityPool = buildConceptualCapacityPool(rankedMissions)
  const starvationIssues = detectMissionStarvation({
    missions: input.missions,
    allocations: rankedMissions,
    generatedAt: input.generatedAt,
  })
  const revenueOperatorGuidance = buildRevenueOperatorCapacityGuidance({
    allocations: rankedMissions,
    queues,
    capacityPool,
  })

  return {
    rankedMissions,
    queues,
    capacityPool,
    starvationIssues,
    revenueOperatorGuidance,
  }
}

export function buildMissionPriorityReadModel(input: GrowthMissionPriorityInput): GrowthMissionPriorityReadModel {
  const result = prioritizeAndAllocateMissions(input)

  return {
    qaMarker: GROWTH_MISSION_PRIORITY_QA_MARKER,
    generatedAt: input.generatedAt,
    rule: GROWTH_MISSION_PRIORITY_RULE,
    schedulerActive: false,
    summary: {
      missionsRanked: result.rankedMissions.length,
      immediate: result.queues.immediate.length,
      today: result.queues.today.length,
      deferred: result.rankedMissions.filter((m) => m.allocationStatus === "deferred").length,
      blocked: result.rankedMissions.filter((m) => m.allocationStatus === "blocked").length,
      abandonRecommended: result.rankedMissions.filter((m) => m.allocationStatus === "abandon_recommended")
        .length,
      starvationIssues: result.starvationIssues.length,
    },
    capacityPool: result.capacityPool,
    rankedMissions: result.rankedMissions,
    queues: result.queues,
    starvationIssues: result.starvationIssues,
    revenueOperatorGuidance: result.revenueOperatorGuidance,
  }
}

export function buildMissionPriorityPlanContext(input: {
  leadId: string
  rankedMissions: GrowthMissionAllocationRecommendation[]
}): GrowthMissionPriorityPlanContext | null {
  const row =
    input.rankedMissions.find((m) => m.leadId === input.leadId && m.allocationStatus === "allocated") ??
    input.rankedMissions.find((m) => m.leadId === input.leadId)

  if (!row) return null

  return {
    missionPriority: row.priority,
    queueBucket: row.queueBucket,
    allocationReason: row.allocationReason,
    deferReason: row.deferReason,
    estimatedRoi: row.priority.estimatedRoi,
    urgencyScore: row.priority.urgencyScore,
    recommendedAction: row.recommendedAction,
  }
}

export function isMissionPrioritySchedulerActive(): false {
  return isAgentSchedulerActive()
}
