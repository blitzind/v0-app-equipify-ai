/** GE-AI-8A — Revenue Mission synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type {
  GrowthMissionHealthState,
  GrowthMissionRecord,
  GrowthMissionStatus,
} from "@/lib/growth/aios/growth/growth-mission-framework-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type {
  GrowthHomeMissionHealthSummary,
  GrowthHomeMissionTimelineItem,
  GrowthHomePlannedAction,
  GrowthHomeRevenueForecast,
  GrowthHomeRevenueMission,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AiRevenueMissionHealthState } from "@/lib/workspace/ai-autonomous-revenue-operator"
import { initiativeConfidenceLabel, deriveInitiativeConfidence } from "@/lib/workspace/ai-proactive-initiative"

/** Revenue Director coordinates — Home never duplicates orchestration engines. */
export const GROWTH_HOME_REVENUE_MISSION_ORCHESTRATION_RULE = GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE

const ACTIVE_MISSION_LIMIT = 3
const APPROVALS_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/os/approvals`

export type GrowthHomeRevenueMissionInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

function mapFrameworkHealth(
  health: GrowthMissionHealthState,
  status: GrowthMissionStatus,
): AiRevenueMissionHealthState {
  if (status === "completed") return "completed"
  if (status === "waiting_for_human") return "needs_review"
  if (status === "blocked" || health === "blocked") return "blocked"
  if (health === "waiting" || health === "stalled") return "waiting"
  return "healthy"
}

function mapFrameworkStage(mission: GrowthMissionRecord): string {
  const stage = mission.currentStage.toLowerCase()
  if (stage.includes("won") || stage.includes("complete")) return "Won"
  if (stage.includes("opportunit")) return "Opportunities"
  if (stage.includes("meeting") || mission.missionType === "prepare_meeting") return "Meetings"
  if (stage.includes("reply") || stage.includes("inbox")) return "Replies"
  if (stage.includes("outbound") || stage.includes("send")) return "Outbound"
  if (stage.includes("approval") || mission.blockedReasons.some((r) => r.toLowerCase().includes("approval"))) {
    return "Approval"
  }
  if (mission.missionType === "prepare_outreach") return "Communication"
  if (mission.missionType === "qualify_lead" || mission.missionType === "identify_buying_committee") {
    return "Qualification"
  }
  if (mission.missionType === "enrich_account" || mission.missionType === "monitor_account") return "Research"
  if (mission.missionType === "close_opportunity") return "Opportunities"
  return "Planning"
}

function missionControls(reviewHref: string, paused: boolean): GrowthHomeRevenueMission["controls"] {
  return [
    {
      kind: "pause",
      label: "Pause mission",
      href: reviewHref,
      disabled: paused,
    },
    {
      kind: "resume",
      label: "Resume mission",
      href: reviewHref,
      disabled: !paused,
    },
    {
      kind: "review",
      label: "Review mission",
      href: reviewHref,
    },
    {
      kind: "open_approvals",
      label: "Open approvals",
      href: APPROVALS_HREF,
    },
  ]
}

function mapFrameworkMission(mission: GrowthMissionRecord): GrowthHomeRevenueMission {
  const health = mapFrameworkHealth(mission.health.state, mission.currentStatus)
  const reviewHref = `${GROWTH_WORKSPACE_BASE_PATH}/leads/${mission.leadId}`
  const paused = mission.currentStatus === "blocked" && mission.blockedReasons.some((r) => r.toLowerCase().includes("pause"))

  return {
    id: mission.missionId,
    title: mission.companyName ?? mission.objective,
    objective: mission.objective,
    progressPercent: Math.round(Math.max(0, Math.min(100, mission.progress * 100))),
    currentStage: mapFrameworkStage(mission),
    estimatedCompletion: mission.nextRecommendation,
    blocker: mission.blockedReasons[0] ?? (health === "needs_review" ? "Waiting for operator review" : null),
    nextAction: mission.nextRecommendation,
    health,
    metrics: [
      { label: "Owner", value: mission.ownerAgent.replaceAll("_", " ") },
      { label: "Priority", value: mission.priority },
    ],
    nextMilestone: mission.decomposition.responsibilities[0]?.responsibility ?? mission.completionCriteria,
    reviewHref,
    controls: missionControls(reviewHref, paused),
  }
}

function buildMissionsFromSnapshot(snapshot: GrowthRevenueDirectorCommandCenterSnapshot): GrowthHomeRevenueMission[] {
  const frameworkMissions = [
    ...snapshot.missionFramework.planner.activeMissions,
    ...snapshot.missionFramework.missions.filter(
      (m) => m.currentStatus === "planned" || m.currentStatus === "blocked" || m.currentStatus === "waiting_for_human",
    ),
  ]

  const mapped = frameworkMissions.map(mapFrameworkMission)

  if (mapped.length > 0) return mapped.slice(0, ACTIVE_MISSION_LIMIT)

  return snapshot.activeMissions.slice(0, ACTIVE_MISSION_LIMIT).map((mission) => ({
    id: mission.missionId,
    title: mission.title,
    objective: mission.title,
    progressPercent: mission.progressPercent,
    currentStage: mission.currentStageId?.replaceAll("_", " ") ?? "Planning",
    estimatedCompletion: mission.running ? "In progress" : "Queued",
    blocker: mission.running ? null : "Waiting to start",
    nextAction: sanitizeHomeNarrative(snapshot.executiveSummary.primaryFocus ?? "Review mission plan"),
    health: mission.running ? "healthy" : "waiting",
    metrics: [{ label: "Work orders", value: String(mission.activeWorkOrderCount) }],
    nextMilestone: sanitizeHomeNarrative(snapshot.executiveSummary.primaryFocus ?? "Advance to next stage"),
    reviewHref: mission.planningReviewHref,
    controls: missionControls(mission.planningReviewHref, !mission.running),
  }))
}

function buildMissionsFromDashboard(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeRevenueMission[] {
  const briefing = dashboard.briefing
  const missions: GrowthHomeRevenueMission[] = []

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const opportunities = metricValue(dashboard, "pipeline-snapshot", "Open opportunities")
  const meetingsWeek = briefing?.meetings.meetings_this_week ?? metricValue(dashboard, "activity", "Meetings today")
  const pipelineProgress = Math.min(100, Math.round((weightedPipeline / 500_000) * 100))

  if (weightedPipeline > 0 || opportunities > 0) {
    const stage = meetingsWeek >= 4 ? "Meetings" : opportunities > 0 ? "Opportunities" : "Qualification"
    missions.push({
      id: "mission-pipeline",
      title: "Increase qualified pipeline this month",
      objective: `Increase qualified pipeline by ${formatHomeCurrency(Math.max(weightedPipeline, 250_000))} this month.`,
      progressPercent: Math.max(pipelineProgress, 10),
      currentStage: stage,
      estimatedCompletion: meetingsWeek >= 4 ? "On track for monthly goal" : "Mid-month checkpoint",
      blocker: null,
      nextAction:
        meetingsWeek < 4
          ? "Book four additional meetings."
          : "Advance qualified opportunities toward close.",
      health: pipelineProgress >= 35 ? "healthy" : "waiting",
      metrics: [
        { label: "Pipeline generated", value: formatHomeCurrency(weightedPipeline) },
        { label: "Qualified opportunities", value: String(opportunities) },
        { label: "Meetings booked", value: String(meetingsWeek) },
      ],
      nextMilestone: "Book four additional meetings.",
      reviewHref: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
      controls: missionControls(metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"), false),
    })
  }

  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  if (pendingDrafts > 0 || activeCampaigns > 0) {
    const stage = pendingDrafts > 0 ? "Approval" : "Outbound"
    missions.push({
      id: "mission-outreach",
      title: "Launch high-fit outreach campaigns",
      objective: sanitizeHomeNarrative(
        briefing?.priorities[0]?.title ?? "Prepare and launch personalized outreach for qualified accounts.",
      ),
      progressPercent: pendingDrafts > 0 ? 65 : 80,
      currentStage: stage,
      estimatedCompletion: pendingDrafts > 0 ? "After approval clears" : "This week",
      blocker: pendingDrafts > 0 ? `${pendingDrafts} items waiting for approval` : null,
      nextAction:
        pendingDrafts > 0
          ? "Review and approve prepared outreach."
          : "Monitor outbound performance and replies.",
      health: pendingDrafts > 0 ? "needs_review" : "healthy",
      metrics: [
        { label: "Campaigns launched", value: String(activeCampaigns) },
        { label: "Prepared drafts", value: String(pendingDrafts) },
      ],
      nextMilestone: pendingDrafts > 0 ? "Clear approval queue" : "Launch next sequence wave",
      reviewHref: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
      controls: missionControls(metricHref(dashboard, "campaign-snapshot", "Approval queue"), false),
    })
  }

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? metricValue(dashboard, "my-queue", "Inbox requiring replies")
  if (hot > 0 || repliesNeedingAttention > 0) {
    const stage = repliesNeedingAttention > 0 ? "Replies" : "Qualification"
    missions.push({
      id: "mission-qualification",
      title: "Convert high-intent prospects",
      objective: `Qualify and advance ${hot + repliesNeedingAttention} high-intent ${pluralize(hot + repliesNeedingAttention, "account", "accounts")}.`,
      progressPercent: Math.min(90, 30 + hot * 10 + repliesNeedingAttention * 5),
      currentStage: stage,
      estimatedCompletion: "This week",
      blocker: repliesNeedingAttention > 0 ? `${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "reply", "replies")} need response` : null,
      nextAction: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Respond to priority inbox threads."),
      health: repliesNeedingAttention > 2 ? "blocked" : hot > 0 ? "healthy" : "waiting",
      metrics: [
        { label: "Hot accounts", value: String(hot) },
        { label: "Replies needing attention", value: String(repliesNeedingAttention) },
      ],
      nextMilestone: "Convert replies into booked meetings",
      reviewHref: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
      controls: missionControls(metricHref(dashboard, "my-queue", "Inbox requiring replies"), false),
    })
  }

  return missions.slice(0, ACTIVE_MISSION_LIMIT)
}

export function buildActiveRevenueMissions(input: GrowthHomeRevenueMissionInput): GrowthHomeRevenueMission[] {
  if (input.revenueDirectorSnapshot) {
    return buildMissionsFromSnapshot(input.revenueDirectorSnapshot)
  }
  return buildMissionsFromDashboard(input.dashboard)
}

export function buildMissionHealthSummaries(missions: GrowthHomeRevenueMission[]): GrowthHomeMissionHealthSummary[] {
  const counts = new Map<AiRevenueMissionHealthState, number>()
  for (const mission of missions) {
    counts.set(mission.health, (counts.get(mission.health) ?? 0) + 1)
  }
  return (["healthy", "waiting", "blocked", "needs_review", "completed"] as AiRevenueMissionHealthState[])
    .map((health) => ({ health, count: counts.get(health) ?? 0 }))
    .filter((row) => row.count > 0)
}

export function buildMissionTimeline(
  input: GrowthHomeRevenueMissionInput,
  missions: GrowthHomeRevenueMission[],
): GrowthHomeMissionTimelineItem[] {
  const { dashboard, revenueDirectorSnapshot } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeMissionTimelineItem[] = []
  const nowIso = dashboard.generatedAt

  for (const mission of missions) {
    items.push({
      id: `timeline-stage-${mission.id}`,
      summary: `Mission progressed to ${mission.currentStage.toLowerCase()}.`,
      occurredAt: nowIso,
      missionId: mission.id,
    })
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? 0
  if (pendingApprovals > 0) {
    items.push({
      id: "timeline-waiting-approval",
      summary: `Mission waiting for approval — ${pendingApprovals} ${pluralize(pendingApprovals, "item", "items")} in queue.`,
      occurredAt: nowIso,
      missionId: missions.find((m) => m.currentStage === "Approval")?.id ?? null,
    })
  }

  const meetingsToday = briefing?.summary.meetings_today ?? 0
  if (meetingsToday > 0) {
    items.push({
      id: "timeline-meeting",
      summary: `Mission booked ${meetingsToday} ${pluralize(meetingsToday, "meeting", "meetings")}.`,
      occurredAt: nowIso,
      missionId: missions[0]?.id ?? null,
    })
  }

  const replies = briefing?.inbox.new_replies ?? 0
  if (replies > 0) {
    items.push({
      id: "timeline-replies",
      summary: `Mission entered replies — ${replies} new ${pluralize(replies, "response", "responses")}.`,
      occurredAt: nowIso,
      missionId: missions.find((m) => m.currentStage === "Replies")?.id ?? null,
    })
  }

  if (revenueDirectorSnapshot) {
    for (const request of revenueDirectorSnapshot.metaRecommender.topRecommendations.slice(0, 2)) {
      items.push({
        id: `timeline-rd-${request.id}`,
        summary: sanitizeHomeNarrative(`Revenue Director coordinated: ${request.title}.`),
        occurredAt: revenueDirectorSnapshot.generatedAt,
        missionId: null,
      })
    }
  }

  return items.slice(0, 8)
}

export function buildNextPlannedActions(
  input: GrowthHomeRevenueMissionInput,
  missions: GrowthHomeRevenueMission[],
): GrowthHomePlannedAction[] {
  const { dashboard, revenueDirectorSnapshot } = input
  const briefing = dashboard.briefing
  const actions: GrowthHomePlannedAction[] = []

  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  if (pendingDrafts > 0) {
    actions.push({
      id: "plan-after-approval",
      summary: `After approval I'll launch ${pendingDrafts} prepared outreach ${pluralize(pendingDrafts, "sequence", "sequences")}.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? `${pendingDrafts} drafts awaiting approval.`),
    })
  }

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  if (hot > 0) {
    actions.push({
      id: "plan-outreach-morning",
      summary: "Tomorrow morning I'll begin outreach to high-intent healthcare accounts.",
      evidence: `${hot} hot ${pluralize(hot, "company", "companies")} in intelligence read model.`,
    })
  }

  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  if (repliesNeedingAttention > 0) {
    actions.push({
      id: "plan-follow-up",
      summary: "If no reply arrives within three days I'll prepare follow-up messaging.",
      evidence: `${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "thread", "threads")} awaiting response.`,
    })
  }

  for (const priority of briefing?.priorities?.slice(0, 2) ?? []) {
    actions.push({
      id: `plan-priority-${priority.priority}`,
      summary: sanitizeHomeNarrative(priority.detail),
      evidence: sanitizeHomeNarrative(priority.title),
    })
  }

  if (revenueDirectorSnapshot) {
    for (const request of revenueDirectorSnapshot.metaRecommender.topRecommendations.slice(0, 2)) {
      actions.push({
        id: `plan-rd-${request.id}`,
        summary: sanitizeHomeNarrative(request.summary),
        evidence: `Revenue Director advisory · ${request.recommendationType}`,
      })
    }
  }

  for (const mission of missions.slice(0, 1)) {
    if (mission.nextAction && actions.length < 5) {
      actions.push({
        id: `plan-mission-${mission.id}`,
        summary: mission.nextAction,
        evidence: `${mission.title} · ${mission.currentStage}`,
      })
    }
  }

  return actions.slice(0, 5)
}

export function buildRevenueForecast(
  input: GrowthHomeRevenueMissionInput,
  missions: GrowthHomeRevenueMission[],
): GrowthHomeRevenueForecast | null {
  const { dashboard, revenueDirectorSnapshot } = input
  const briefing = dashboard.briefing
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  if (weightedPipeline <= 0 && !revenueDirectorSnapshot) return null

  const monthlyGoalValue = Math.max(500_000, Math.round(weightedPipeline * 2.7))
  const revenue = briefing?.revenue.revenue ?? weightedPipeline
  const projectedValue = Math.max(revenue, weightedPipeline)
  const projectedPercent = Math.min(100, Math.round((projectedValue / monthlyGoalValue) * 100))
  const remainingValue = Math.max(0, monthlyGoalValue - projectedValue)

  const blockedCount = missions.filter((m) => m.health === "blocked" || m.health === "needs_review").length
  const risk =
    revenueDirectorSnapshot?.executiveSummary.revenueHealth === "blocked"
      ? "Revenue Director flagged blocked orchestration."
      : blockedCount > 0
        ? `${blockedCount} ${pluralize(blockedCount, "mission", "missions")} blocked on approval or operator action.`
        : "Pipeline momentum is steady — monitor reply velocity."

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const confidence = initiativeConfidenceLabel(
    deriveInitiativeConfidence({
      impactScore: engagementScore || projectedPercent,
      hasMetricEvidence: weightedPipeline > 0,
    }),
  )

  return {
    monthlyGoal: formatHomeCurrency(monthlyGoalValue),
    projectedAttainment: formatHomeCurrency(projectedValue),
    projectedPercent,
    remainingWork: formatHomeCurrency(remainingValue),
    risk,
    confidence,
  }
}
