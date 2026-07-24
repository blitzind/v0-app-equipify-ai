/** GE-AVA-MISSION-CENTER-1A — Unified Mission Center synthesizer (client-safe, aggregation only). */

import { buildAiOsMissionPlanningHref } from "@/lib/growth/aios/ai-os-public-routes"
import { GROWTH_AI_OS_PUBLIC_BASE_PATH } from "@/lib/growth/aios/ai-os-public-routes"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import {
  buildActiveRevenueMissions,
  type GrowthHomeRevenueMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer"
import { initiativeConfidenceLabel, deriveInitiativeConfidence } from "@/lib/workspace/ai-proactive-initiative"
import {
  teammateActivityForPresentationStage,
  mapRuntimeStageToPresentationStage,
  presentationStageStatusLabel,
} from "@/lib/growth/mission-center/growth-mission-center-stage-mapper"
import {
  buildMissionCenterHealthSummary,
  mapRevenueHealthToMissionHealth,
  objectiveProgressPercent,
  resolveObjectiveMissionHealth,
} from "@/lib/growth/mission-center/growth-mission-center-health"
import {
  buildCompletedTodayFromObjective,
  buildMissionCenterTimeline,
} from "@/lib/growth/mission-center/growth-mission-center-timeline"
import { buildMissionDetailSections } from "@/lib/growth/mission-center/growth-mission-center-detail-sections"
import type {
  GrowthMissionCenterCard,
  GrowthMissionCenterControl,
  GrowthMissionCenterDetailSection,
  GrowthMissionCenterInput,
  GrowthMissionCenterViewModel,
} from "@/lib/growth/mission-center/growth-mission-center-types"
import { GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-center-types"
import {
  GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
  missionLifecycleStatusLabel,
} from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { formatMissionFindLeadsMonitoringStatus } from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import { buildGrowthReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

const ACTIVE_MISSION_LIMIT = 3
const APPROVALS_HREF = buildGrowthReviewHref({ tab: "packages" })

function missionControls(input: {
  detailHref: string
  paused: boolean
  pendingApprovalCount: number
}): GrowthMissionCenterControl[] {
  return [
    {
      kind: "pause",
      label: "Pause Mission",
      href: input.detailHref,
      disabled: input.paused,
    },
    {
      kind: "resume",
      label: "Resume Mission",
      href: input.detailHref,
      disabled: !input.paused,
    },
    {
      kind: "view_details",
      label: "View Details",
      href: input.detailHref,
    },
    {
      kind: "review_approvals",
      label: "Review Approvals",
      href: APPROVALS_HREF,
      disabled: input.pendingApprovalCount <= 0,
    },
    {
      kind: "review_research",
      label: "Review Research",
      href: input.detailHref,
    },
    {
      kind: "review_leads",
      label: "Review Leads",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/leads`,
    },
  ]
}

function mapObjectiveToCard(
  objective: GrowthObjective,
  businessProfileApproved: boolean,
  pendingApprovalCount: number,
  teammateName?: string | null,
): GrowthMissionCenterCard {
  const teammate = resolveAiTeammatePresentation(teammateName)
  const presentationStage = businessProfileApproved
    ? mapRuntimeStageToPresentationStage(objective.runtime?.currentStageId)
    : "business_profile"
  const health = resolveObjectiveMissionHealth(objective, businessProfileApproved, pendingApprovalCount)
  const detailHref =
    buildAiOsMissionPlanningHref(objective.id) ?? `${GROWTH_WORKSPACE_BASE_PATH}/objectives`
  const researchArtifactCount =
    objective.executionContext?.stages?.research?.artifacts?.length ??
    objective.executionContext?.stages?.discover?.artifacts?.length ??
    0
  const waitingOn =
    !businessProfileApproved
      ? "Create Business Profile"
      : pendingApprovalCount > 0 && presentationStage === "approval"
        ? "Approve outreach drafts"
        : health === "waiting_on_you"
          ? "Your review"
          : objective.recommendations[0]?.requiresApproval
            ? objective.recommendations[0].recommendation
            : null

  const confidence = initiativeConfidenceLabel(
    deriveInitiativeConfidence({
      impactScore: objectiveProgressPercent(objective),
      hasMetricEvidence: Boolean(objective.runtime?.running),
    }),
  )

  const missionRuntime =
    objective.executionContext?.missionRuntime?.qa_marker === GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER
      ? objective.executionContext.missionRuntime
      : null
  const findLeadsBinding = missionRuntime?.datamoon?.importRequestJson ? missionRuntime.datamoon : null
  const bindingActivity = findLeadsBinding?.keepMonitoring
    ? missionRuntime?.lifecycleState === "finding_leads"
      ? missionRuntime.activityLabel
      : formatMissionFindLeadsMonitoringStatus(findLeadsBinding)
    : null

  return {
    id: objective.id,
    name: objective.title,
    statusLabel: businessProfileApproved
      ? missionRuntime
        ? missionLifecycleStatusLabel(missionRuntime.lifecycleState)
        : presentationStageStatusLabel(presentationStage)
      : "Blocked",
    progressPercent: objectiveProgressPercent(objective),
    priority: objective.priority,
    ownerLabel: teammate.name,
    presentationStage,
    currentActivity:
      bindingActivity ??
      missionRuntime?.activityLabel ??
      teammateActivityForPresentationStage(teammate, presentationStage, {
        companyCount: researchArtifactCount > 0 ? researchArtifactCount : undefined,
      }),
    waitingOn,
    recommendedNextAction:
      objective.recommendations[0]?.recommendation ??
      objective.plan?.stages.find((s) => s.id === objective.runtime?.currentStageId)?.recommendations?.[0] ??
      (businessProfileApproved ? "Review mission progress" : "Create Business Profile"),
    confidence,
    health,
    completedToday: buildCompletedTodayFromObjective(objective),
    detailHref,
    controls: missionControls({
      detailHref,
      paused: objective.status === "paused" || objective.emergencyStopActive,
      pendingApprovalCount,
    }),
    blockedReason: !businessProfileApproved
      ? `${teammate.name} needs to understand your business first.`
      : objective.emergencyStopActive
        ? "Mission paused for safety."
        : null,
    businessProfileBlocked: !businessProfileApproved,
    sourceKind: "objective",
  }
}

function mapRevenueMissionToCard(
  mission: ReturnType<typeof buildActiveRevenueMissions>[number],
  pendingApprovalCount: number,
  teammateName?: string | null,
): GrowthMissionCenterCard {
  const teammate = resolveAiTeammatePresentation(teammateName)
  const stageMap: Record<string, GrowthMissionCenterCard["presentationStage"]> = {
    Research: "research",
    Qualification: "qualification",
    Opportunities: "opportunity",
    Communication: "outreach_preparation",
    Approval: "approval",
    Outbound: "execution",
    Replies: "learning",
    Meetings: "opportunity",
    Won: "learning",
    Planning: "lead_discovery",
  }
  const presentationStage = stageMap[mission.currentStage] ?? "research"

  return {
    id: mission.id,
    name: mission.title,
    statusLabel: mission.currentStage,
    progressPercent: mission.progressPercent,
    priority: "high",
    ownerLabel: teammate.name,
    presentationStage,
    currentActivity: teammateActivityForPresentationStage(teammate, presentationStage),
    waitingOn:
      mission.health === "needs_review"
        ? "Approve outreach drafts"
        : mission.blocker,
    recommendedNextAction: mission.nextAction,
    confidence: "Medium",
    health: mapRevenueHealthToMissionHealth(mission.health),
    completedToday: [],
    detailHref: mission.reviewHref,
    controls: missionControls({
      detailHref: mission.reviewHref,
      paused: false,
      pendingApprovalCount,
    }),
    blockedReason: mission.blocker,
    businessProfileBlocked: false,
    sourceKind: "revenue_heuristic",
  }
}

function selectActiveObjectives(objectives: GrowthObjective[]): GrowthObjective[] {
  return objectives
    .filter((o) => o.status === "active" || o.status === "planning" || o.runtime?.running)
    .sort((a, b) => {
      const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityRank[a.priority] - priorityRank[b.priority]
    })
    .slice(0, ACTIVE_MISSION_LIMIT)
}

export function synthesizeGrowthMissionCenter(input: GrowthMissionCenterInput): GrowthMissionCenterViewModel {
  const generatedAt = input.generatedAt ?? input.dashboard.generatedAt
  const businessProfileApproved = input.businessProfileApproved ?? false
  const pendingApprovalCount =
    input.revenueDirectorSnapshot?.humanApprovalCenter.summary.totalPending ?? 0

  const objectives = input.objectiveDashboard?.objectives ?? []
  const activeObjectives = selectActiveObjectives(objectives)

  let activeMissions: GrowthMissionCenterCard[] = activeObjectives.map((objective) =>
    mapObjectiveToCard(objective, businessProfileApproved, pendingApprovalCount),
  )

  if (activeMissions.length === 0) {
    const revenueInput: GrowthHomeRevenueMissionInput = {
      dashboard: input.dashboard,
      revenueDirectorSnapshot: input.revenueDirectorSnapshot ?? undefined,
    }
    activeMissions = buildActiveRevenueMissions(revenueInput)
      .slice(0, ACTIVE_MISSION_LIMIT)
      .map((mission) => mapRevenueMissionToCard(mission, pendingApprovalCount))
  }

  const revenueInput: GrowthHomeRevenueMissionInput = {
    dashboard: input.dashboard,
    revenueDirectorSnapshot: input.revenueDirectorSnapshot ?? undefined,
  }
  const revenueMissions = buildActiveRevenueMissions(revenueInput)

  return {
    readOnly: true,
    qaMarker: GROWTH_AVA_MISSION_CENTER_1A_QA_MARKER,
    generatedAt,
    businessProfileApproved,
    activeMissions,
    healthSummary: buildMissionCenterHealthSummary(activeMissions),
    timeline: buildMissionCenterTimeline({
      dashboard: input.dashboard,
      objectives: activeObjectives,
      revenueDirectorSnapshot: input.revenueDirectorSnapshot,
      revenueMissions,
    }),
    pendingApprovalCount,
    approvalsHref: APPROVALS_HREF,
  }
}

export function buildMissionCenterDetailView(input: {
  mission: GrowthMissionCenterCard
  objective?: GrowthObjective | null
  businessProfileApproved: boolean
  pendingApprovalCount: number
}): {
  mission: GrowthMissionCenterCard
  sections: GrowthMissionCenterDetailSection[]
} {
  if (input.objective) {
    return {
      mission: input.mission,
      sections: buildMissionDetailSections({
        objective: input.objective,
        businessProfileApproved: input.businessProfileApproved,
        pendingApprovalCount: input.pendingApprovalCount,
      }),
    }
  }

  return {
    mission: input.mission,
    sections: [
      {
        id: "overview",
        title: "Mission Overview",
        status: input.mission.health === "blocked" ? "blocked" : "in_progress",
        summary: input.mission.currentActivity,
        items: [input.mission.recommendedNextAction],
        href: input.mission.detailHref,
      },
    ],
  }
}

export type { GrowthMissionCenterDetailSection }
