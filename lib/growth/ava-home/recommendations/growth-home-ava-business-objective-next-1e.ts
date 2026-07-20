/**
 * GE-AIOS-NEXT-1E — Business objective leadership projection (presentation-only).
 * Reuses existing GrowthObjective authority — no duplicate objective engine.
 */

import type { GrowthObjective, GrowthObjectivePriority } from "@/lib/growth/objectives/growth-objective-types"
import { objectiveProgressPercent, resolveObjectiveMissionHealth } from "@/lib/growth/mission-center/growth-mission-center-health"
import { missionLifecycleStatusLabel } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { selectAcquisitionMission } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type { GrowthHomeMissionDiscoverySnapshot } from "@/lib/growth/mission-center/growth-home-mission-discovery-snapshot"
import type {
  GrowthHomeAvaRecommendationExperience,
  GrowthHomeAvaRecommendationItem,
  GrowthHomeAvaRecommendationKind,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"
import type { GrowthHomeAvaRecommendationOutcomeProjection } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-outcome-next-1d-types"
import {
  GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER,
  GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE,
  type GrowthHomeAvaBusinessObjectiveLeadershipPayload,
  type GrowthHomeAvaBusinessObjectiveProjection,
  type GrowthHomeAvaBusinessScoreboardMetric,
  type GrowthHomeAvaObjectiveHealthStatus,
  type GrowthHomeAvaRecommendationObjectiveContext,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-business-objective-next-1e-types"

const PRIORITY_RANK: Record<GrowthObjectivePriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const HEALTH_LABELS: Record<GrowthHomeAvaObjectiveHealthStatus, string> = {
  ahead: "Ahead",
  on_track: "On Track",
  needs_attention: "Needs Attention",
  blocked: "Blocked",
  waiting_on_you: "Waiting on You",
  waiting_on_customer: "Waiting on Customer",
  pipeline_risk: "Pipeline Risk",
  confidence_risk: "Confidence Risk",
  completed: "Complete",
}

function activeObjectives(objectives: GrowthObjective[]): GrowthObjective[] {
  return objectives.filter(
    (entry) =>
      entry.status === "active" ||
      entry.status === "planning" ||
      entry.status === "completed" ||
      entry.runtime?.running,
  )
}

function selectPrimaryObjective(objectives: GrowthObjective[]): GrowthObjective | null {
  const active =
    selectAcquisitionMission(objectives) ?? selectHighestPriorityObjective(objectives)
  if (active) return active
  const completed = activeObjectives(objectives).filter(
    (entry) =>
      entry.status === "completed" ||
      (entry.targetValue > 0 && entry.currentValue >= entry.targetValue),
  )
  return completed[0] ?? null
}

function selectHighestPriorityObjective(objectives: GrowthObjective[]): GrowthObjective | null {
  const active = activeObjectives(objectives).filter((entry) => entry.status !== "completed")
  if (active.length === 0) return null
  return [...active].sort((left, right) => PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority])[0] ?? null
}

function selectSecondaryObjective(
  objectives: GrowthObjective[],
  primaryId: string | null,
): GrowthObjective | null {
  const active = activeObjectives(objectives).filter(
    (entry) => entry.id !== primaryId && entry.status !== "completed",
  )
  if (active.length === 0) return null
  return [...active].sort((left, right) => PRIORITY_RANK[right.priority] - PRIORITY_RANK[left.priority])[0] ?? null
}

function buildProgressLabel(objective: GrowthObjective): string {
  const current = Math.max(0, Math.round(objective.currentValue))
  const target = Math.max(0, Math.round(objective.targetValue))
  switch (objective.objectiveType) {
    case "opportunities_created":
      return `${current} of ${target} packages prepared`
    case "meetings_booked":
      return `${current} of ${target} meetings booked`
    case "demos_booked":
      return `${current} of ${target} demos booked`
    case "customers_acquired":
      return `${current} of ${target} customers acquired`
    case "pipeline_value":
      return target > 0 ? `Revenue target ${Math.min(100, Math.round((current / target) * 100))}% complete` : `${current} pipeline value tracked`
    default:
      return target > 0 ? `${current} of ${target} complete` : objective.title
  }
}

function buildMilestoneLabel(objective: GrowthObjective): string | null {
  const stageId = objective.runtime?.currentStageId
  if (!stageId) return null
  const stage = objective.plan?.stages.find((entry) => entry.id === stageId)
  return stage?.label ?? missionLifecycleStatusLabel(
    objective.executionContext?.missionRuntime?.lifecycleState ?? "planning",
  )
}

function resolveObjectiveHealth(input: {
  objective: GrowthObjective
  businessProfileApproved: boolean
  pendingApprovalCount: number
  pipelineLow: boolean
}): GrowthHomeAvaObjectiveHealthStatus {
  const missionHealth = resolveObjectiveMissionHealth(
    input.objective,
    input.businessProfileApproved,
    input.pendingApprovalCount,
  )
  if (input.objective.status === "completed" || input.objective.currentValue >= input.objective.targetValue) {
    return "completed"
  }
  if (input.pipelineLow && input.objective.objectiveType !== "meetings_booked") return "pipeline_risk"
  if (missionHealth === "blocked") return "blocked"
  if (missionHealth === "waiting_on_you") return "waiting_on_you"
  if (missionHealth === "needs_attention") return "needs_attention"
  const progress = objectiveProgressPercent(input.objective)
  if (progress >= 100) return "completed"
  if (progress >= 85) return "ahead"
  if (progress < 35 && input.objective.runtime?.running) return "confidence_risk"
  return "on_track"
}

function buildForecastLabel(health: GrowthHomeAvaObjectiveHealthStatus): string {
  return HEALTH_LABELS[health]
}

function buildWhyPriority(objective: GrowthObjective, missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null): string[] {
  const lines: string[] = []
  if (objective.plan?.successMetrics[0]) lines.push(objective.plan.successMetrics[0])
  if (missionDiscovery?.activityLabel) lines.push(missionDiscovery.activityLabel)
  if (objective.priority === "critical" || objective.priority === "high") {
    lines.push(`Marked ${objective.priority} priority in our objective plan.`)
  }
  if (lines.length === 0 && objective.description) lines.push(objective.description)
  return lines.slice(0, 3)
}

function buildBlockers(input: {
  objective: GrowthObjective
  businessProfileApproved: boolean
  pendingApprovalCount: number
  pipelineLow: boolean
}): string[] {
  const blockers: string[] = []
  if (!input.businessProfileApproved) blockers.push("Approved Business Profile is required before this objective can run.")
  const stageId = input.objective.runtime?.currentStageId
  const stageBlockers = stageId ? input.objective.runtime?.stageStates[stageId]?.blockers ?? [] : []
  blockers.push(...stageBlockers)
  if (input.pendingApprovalCount > 0) blockers.push(`${input.pendingApprovalCount} package${input.pendingApprovalCount === 1 ? "" : "s"} waiting for your approval.`)
  if (input.pipelineLow) blockers.push("Pipeline coverage is running low on fresh qualified companies.")
  return blockers.slice(0, 3)
}

export function projectGrowthHomeAvaBusinessObjective(input: {
  objective: GrowthObjective
  businessProfileApproved: boolean
  pendingApprovalCount: number
  pipelineLow: boolean
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  ownerLabel?: string
  nextObjectiveTitle?: string | null
}): GrowthHomeAvaBusinessObjectiveProjection {
  const completed =
    input.objective.status === "completed" ||
    (input.objective.targetValue > 0 && input.objective.currentValue >= input.objective.targetValue)
  const health = completed ? "completed" : resolveObjectiveHealth(input)
  const progressPercent =
    input.objective.targetValue > 0 ? Math.min(100, objectiveProgressPercent(input.objective)) : null

  return {
    id: input.objective.id,
    title: input.objective.title,
    objectiveType: input.objective.objectiveType,
    targetValue: input.objective.targetValue,
    currentValue: input.objective.currentValue,
    progressLabel: buildProgressLabel(input.objective),
    progressPercent,
    milestoneLabel: buildMilestoneLabel(input.objective),
    forecastLabel: buildForecastLabel(health),
    health,
    healthLabel: HEALTH_LABELS[health],
    ownerLabel: input.ownerLabel ?? "Ava",
    whyPriority: buildWhyPriority(input.objective, input.missionDiscovery),
    blockers: buildBlockers(input),
    completed,
    completionMessage: completed ? "We achieved this objective." : null,
    nextObjectiveTitle: completed ? input.nextObjectiveTitle ?? null : null,
  }
}

export function buildGrowthHomeAvaBusinessScoreboard(input: {
  primaryObjective: GrowthHomeAvaBusinessObjectiveProjection | null
  missionDiscovery: GrowthHomeMissionDiscoverySnapshot | null
  meetingsThisWeek: number
  openOpportunities: number
  leadPoolVisible: number
  pendingApprovals: number
}): GrowthHomeAvaBusinessScoreboardMetric[] {
  const metrics: GrowthHomeAvaBusinessScoreboardMetric[] = []

  if (input.primaryObjective?.objectiveType === "opportunities_created") {
    metrics.push({
      id: "qualified_packages",
      label: "Qualified Packages",
      valueLabel: `${Math.round(input.primaryObjective.currentValue)} / ${Math.round(input.primaryObjective.targetValue)}`,
    })
  } else if (input.openOpportunities > 0) {
    metrics.push({
      id: "qualified_packages",
      label: "Qualified Packages",
      valueLabel: `${input.openOpportunities} open`,
    })
  }

  if (input.primaryObjective?.objectiveType === "meetings_booked") {
    metrics.push({
      id: "meetings",
      label: "Meetings",
      valueLabel: `${Math.round(input.primaryObjective.currentValue)} / ${Math.round(input.primaryObjective.targetValue)}`,
    })
  } else if (input.meetingsThisWeek > 0) {
    metrics.push({
      id: "meetings",
      label: "Meetings",
      valueLabel: `${input.meetingsThisWeek} this week`,
    })
  }

  metrics.push({
    id: "pipeline_health",
    label: "Pipeline Health",
    valueLabel: input.missionDiscovery?.pipelineLow ? "Needs coverage" : "Healthy",
  })

  if (input.leadPoolVisible > 0) {
    metrics.push({
      id: "portfolio",
      label: "Portfolio",
      valueLabel: `${input.leadPoolVisible} qualified companies`,
    })
  }

  const researchRemaining = input.missionDiscovery?.counters.researchingCount ?? 0
  if (researchRemaining > 0) {
    metrics.push({
      id: "research_queue",
      label: "Research Queue",
      valueLabel: `${researchRemaining} remaining`,
    })
  }

  if (input.pendingApprovals > 0) {
    metrics.push({
      id: "approvals",
      label: "Waiting on You",
      valueLabel: `${input.pendingApprovals} package${input.pendingApprovals === 1 ? "" : "s"}`,
    })
  }

  return metrics.slice(0, 5)
}

export function buildGrowthHomeAvaBusinessObjectiveLeadershipPayload(input: {
  objectives: GrowthObjective[]
  missionDiscovery?: GrowthHomeMissionDiscoverySnapshot | null
  businessProfileApproved?: boolean
  pendingApprovalCount?: number
  meetingsThisWeek?: number
  openOpportunities?: number
  leadPoolVisible?: number
  ownerLabel?: string
}): GrowthHomeAvaBusinessObjectiveLeadershipPayload {
  const missionDiscovery = input.missionDiscovery ?? null
  const pipelineLow = missionDiscovery?.pipelineLow ?? false
  const primaryRaw = selectPrimaryObjective(input.objectives)
  const secondaryRaw = selectSecondaryObjective(input.objectives, primaryRaw?.id ?? null)
  const primaryObjective = primaryRaw
    ? projectGrowthHomeAvaBusinessObjective({
        objective: primaryRaw,
        businessProfileApproved: input.businessProfileApproved ?? true,
        pendingApprovalCount: input.pendingApprovalCount ?? 0,
        pipelineLow,
        missionDiscovery,
        ownerLabel: input.ownerLabel,
        nextObjectiveTitle: secondaryRaw?.title ?? null,
      })
    : null
  const secondaryObjective = secondaryRaw
    ? projectGrowthHomeAvaBusinessObjective({
        objective: secondaryRaw,
        businessProfileApproved: input.businessProfileApproved ?? true,
        pendingApprovalCount: input.pendingApprovalCount ?? 0,
        pipelineLow,
        missionDiscovery,
        ownerLabel: input.ownerLabel,
      })
    : null

  const recommendationIntro = primaryObjective
    ? primaryObjective.completed
      ? "Here's what I recommend for our next objective."
      : "Here's what I recommend to help us achieve it."
    : "Here's what I recommend."

  return {
    qaMarker: GROWTH_AIOS_NEXT_1E_AVA_BUSINESS_OBJECTIVE_QA_MARKER,
    ownershipPrinciple: GROWTH_AIOS_NEXT_1E_AVA_OBJECTIVE_OWNERSHIP_PRINCIPLE,
    teamObjectiveLine: "Our current objective",
    recommendationIntro,
    primaryObjective,
    secondaryObjective,
    scoreboard: buildGrowthHomeAvaBusinessScoreboard({
      primaryObjective,
      missionDiscovery,
      meetingsThisWeek: input.meetingsThisWeek ?? 0,
      openOpportunities: input.openOpportunities ?? 0,
      leadPoolVisible: input.leadPoolVisible ?? missionDiscovery?.leadPoolVisible ?? 0,
      pendingApprovals: input.pendingApprovalCount ?? 0,
    }),
  }
}

function recommendationSupportsObjective(
  kind: GrowthHomeAvaRecommendationKind,
  outcomeType: GrowthHomeAvaRecommendationOutcomeProjection["outcomeType"] | undefined,
  objective: GrowthHomeAvaBusinessObjectiveProjection,
): boolean {
  if (objective.objectiveType === "opportunities_created") {
    return (
      kind === "approval_package" ||
      kind === "lead_decision" ||
      kind === "operator_focus" ||
      outcomeType === "prepare_opportunity_package"
    )
  }
  if (objective.objectiveType === "meetings_booked") {
    return kind === "approval_package" || outcomeType === "launch_outreach" || outcomeType === "increase_meetings"
  }
  if (objective.objectiveType === "customers_acquired" || objective.objectiveType === "pipeline_value") {
    return outcomeType === "grow_qualified_pipeline" || kind === "mission_discovery"
  }
  return true
}

export function buildGrowthHomeAvaRecommendationObjectiveContext(input: {
  item: GrowthHomeAvaRecommendationItem
  objective: GrowthHomeAvaBusinessObjectiveProjection | null
  secondaryObjective?: GrowthHomeAvaBusinessObjectiveProjection | null
}): GrowthHomeAvaRecommendationObjectiveContext | null {
  const objective = input.objective
  if (!objective || objective.completed) return null
  const outcomeType = input.item.outcomeProjection?.outcomeType
  if (!recommendationSupportsObjective(input.item.kind, outcomeType, objective)) return null

  let contributionLabel: string | null = null

  if (objective.objectiveType === "opportunities_created") {
    const nextPackage = Math.min(Math.round(objective.currentValue) + 1, Math.round(objective.targetValue))
    if (input.item.kind === "approval_package") {
      contributionLabel = `Approving this unlocks outreach on package #${nextPackage}.`
    } else if (outcomeType === "prepare_opportunity_package") {
      contributionLabel = `This will likely become opportunity package #${nextPackage}.`
    }
  } else if (objective.objectiveType === "meetings_booked" && outcomeType === "launch_outreach") {
    contributionLabel = "This moves us closer to the next booked meeting."
  } else if (outcomeType === "grow_qualified_pipeline") {
    contributionLabel = "This expands the qualified pipeline feeding our objective."
  }

  if (!contributionLabel && input.item.outcomeProjection?.businessImpact) {
    contributionLabel = input.item.outcomeProjection.businessImpact
  }

  const remainingToGoal = Math.max(0, Math.round(objective.targetValue - objective.currentValue))
  let remainingAfterRecommendation = remainingToGoal
  if (objective.objectiveType === "opportunities_created" && contributionLabel) {
    remainingAfterRecommendation = Math.max(0, remainingToGoal - 1)
  }

  return {
    objectiveTitle: objective.title,
    contributionLabel,
    remainingLabel:
      remainingAfterRecommendation > 0
        ? `${remainingAfterRecommendation} ${objective.objectiveType === "meetings_booked" ? "meetings" : "packages"} remaining toward our objective.`
        : null,
    nextMilestoneLabel: objective.milestoneLabel,
    futureObjectiveLabel: input.secondaryObjective?.title ?? null,
  }
}

export function enrichGrowthHomeAvaRecommendationItemNext1e(input: {
  item: GrowthHomeAvaRecommendationItem
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
}): GrowthHomeAvaRecommendationItem {
  const objectiveContext = buildGrowthHomeAvaRecommendationObjectiveContext({
    item: input.item,
    objective: input.businessObjectiveLeadership?.primaryObjective ?? null,
    secondaryObjective: input.businessObjectiveLeadership?.secondaryObjective ?? null,
  })

  if (!objectiveContext) return input.item

  const businessImpact = objectiveContext.contributionLabel ?? input.item.outcomeProjection?.businessImpact ?? null

  return {
    ...input.item,
    outcomeProjection: input.item.outcomeProjection
      ? {
          ...input.item.outcomeProjection,
          businessImpact,
          objectiveContext,
        }
      : input.item.outcomeProjection,
    explanation: input.item.explanation
      ? {
          ...input.item.explanation,
          whyChosen: [
            `This advances our current objective: ${objectiveContext.objectiveTitle}.`,
            ...input.item.explanation.whyChosen,
          ].slice(0, 5),
        }
      : input.item.explanation,
  }
}

export function enrichGrowthHomeAvaRecommendationExperienceNext1e(input: {
  experience: GrowthHomeAvaRecommendationExperience
  businessObjectiveLeadership?: GrowthHomeAvaBusinessObjectiveLeadershipPayload | null
}): GrowthHomeAvaRecommendationExperience {
  const leadership = input.businessObjectiveLeadership ?? null
  return {
    ...input.experience,
    recommendationIntro: leadership?.recommendationIntro ?? input.experience.recommendationIntro,
    recommendations: input.experience.recommendations.map((item) =>
      enrichGrowthHomeAvaRecommendationItemNext1e({
        item,
        businessObjectiveLeadership: leadership,
      }),
    ),
  }
}
