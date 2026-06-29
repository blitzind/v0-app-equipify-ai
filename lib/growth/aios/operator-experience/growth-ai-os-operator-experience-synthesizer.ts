/** GE-AI-UX-1A — Operator experience synthesizer (client-safe). */

import type { AiOsCommandCenterAttentionItem } from "@/lib/growth/aios/ai-os-command-center-types"
import type { AiOsDailyBriefing } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import type { AiOsOperationsDashboardReadModel } from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import type { GrowthAdaptiveCalibrationReadModel } from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthClosedLoopLearningReadModel } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthCommunicationEngineReadModel } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import type { GrowthHumanApprovalCenterReadModel } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"
import { GROWTH_COMMUNICATION_ENGINE_QA_MARKER } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_REVENUE_DIRECTOR_QA_MARKER } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import {
  AI_OS_APPROVAL_OUTCOME_BUCKETS,
  AI_OS_HOME_PRIMARY_CTA,
} from "@/lib/workspace/ai-os-outcome-first-terminology"
import {
  defaultTeammatePresentation,
  teammateAttributeOutcomes,
  teammateHomeIntro,
  teammatePreparedSummary,
  teammatePresenceLabel,
} from "@/lib/workspace/ai-teammate-voice"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import type {
  GrowthAiOsOperatorAiImprovement,
  GrowthAiOsOperatorAttentionCard,
  GrowthAiOsOperatorBusinessMetric,
  GrowthAiOsOperatorExecutiveBrief,
  GrowthAiOsOperatorExperienceViewModel,
  GrowthAiOsOperatorHealthTone,
  GrowthAiOsOperatorRevenueRecommendation,
  GrowthAiOsOperatorSystemStatus,
  GrowthAiOsOperatorWorkingItem,
} from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import {
  GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER,
} from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import { GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER } from "@/lib/growth/aios/ai-os-daily-briefing-types"
import { GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER } from "@/lib/growth/aios/ai-os-operations-dashboard-types"
import {
  formatOperatorTimelineTime,
  translateOperatorActivityHeadline,
} from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-event-translator"

const ATTENTION_LIMIT = 5
const TIMELINE_LIMIT = 12

export type GrowthAiOsOperatorExperienceInput = {
  dashboard: AiOsOperationsDashboardReadModel
  dailyBriefing: AiOsDailyBriefing
  needsAttention?: AiOsCommandCenterAttentionItem[]
  revenueDirector?: GrowthRevenueDirectorReadModel
  humanApprovalCenter?: GrowthHumanApprovalCenterReadModel
  communicationEngine?: GrowthCommunicationEngineReadModel
  boundedAutonomousOutbound?: GrowthBoundedAutonomousOutboundReadModel
  adaptiveCalibration?: GrowthAdaptiveCalibrationReadModel
  closedLoopLearning?: GrowthClosedLoopLearningReadModel
  teammate?: AiTeammatePresentation
  nativeRevenueDecisionRecommendation?: GrowthAiOsOperatorRevenueRecommendation | null
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function healthPercent(status: string): number {
  if (status === "healthy") return 92
  if (status === "degraded") return 74
  return 48
}

function healthTone(status: string): GrowthAiOsOperatorHealthTone {
  if (status === "healthy") return "healthy"
  if (status === "degraded") return "attention"
  return "critical"
}

function impactScoreFromLevel(level: "high" | "medium" | "low"): number {
  if (level === "high") return 90
  if (level === "medium") return 60
  return 30
}

function buildExecutiveBrief(
  dashboard: AiOsOperationsDashboardReadModel,
  dailyBriefing: AiOsDailyBriefing,
  teammate: AiTeammatePresentation,
): GrowthAiOsOperatorExecutiveBrief {
  const overview = dashboard.executiveOverview
  const exec = dashboard.executionAgentStatus
  const outreach = dashboard.outreachAgentStatus
  const meeting = dashboard.meetingAgentStatus
  const hour = new Date(dashboard.generatedAt).getHours()
  const researched = exec.completedExecutions + exec.activeExecutions
  const qualified = dashboard.activeWork.filter((row) => row.category === "autonomous_qualification").length
  const drafts = outreach.draftsPrepared
  const briefs = meeting.briefsPrepared
  const criticalIssues = dailyBriefing.risks.filter((row) => row.severity === "high").length

  const highlightActions = [
    `Researched ${researched} ${researched === 1 ? "company" : "companies"}`,
    `Qualified ${qualified > 0 ? qualified : dashboard.missionPriorities.length} ${qualified === 1 ? "opportunity" : "opportunities"}`,
    `Prepared ${drafts} personalized ${drafts === 1 ? "campaign" : "campaigns"}`,
    `Booked ${briefs} ${briefs === 1 ? "meeting" : "meetings"}`,
    ...(criticalIssues > 0 ? [`Flagged ${criticalIssues} ${criticalIssues === 1 ? "exception" : "exceptions"} for your review`] : []),
  ]
  const todayHighlights = teammateAttributeOutcomes(teammate, highlightActions)

  const primaryAction =
    dailyBriefing.recommendedNextActions[0] ??
    dailyBriefing.needsApproval[0] ??
    dailyBriefing.topPriorities[0]

  return {
    greeting: `${greetingForHour(hour)}.`,
    teammateName: teammate.name,
    teammateRole: teammate.role,
    introLine: teammateHomeIntro(teammate),
    aiHealthPercent: healthPercent(overview.aiHealthStatus),
    aiHealthTone: healthTone(overview.aiHealthStatus),
    aiHealthLabel: overview.aiHealthLabel,
    todayHighlights,
    criticalIssueCount: criticalIssues,
    primaryCtaLabel: AI_OS_HOME_PRIMARY_CTA,
    primaryCtaHref: primaryAction?.href ?? "/growth/os/approvals",
  }
}

function buildAttentionCards(
  input: GrowthAiOsOperatorExperienceInput,
  teammate: AiTeammatePresentation,
): GrowthAiOsOperatorAttentionCard[] {
  const cards: GrowthAiOsOperatorAttentionCard[] = []

  for (const item of input.dailyBriefing.needsApproval.slice(0, 3)) {
    cards.push({
      id: `brief-approval-${item.id}`,
      headline: item.title,
      summary: item.reason,
      estimatedImpact: `${item.impact} impact · ${item.urgency} urgency`,
      ctaLabel: item.linkLabel ?? "Review",
      ctaHref: item.href ?? "/growth/os/approvals",
      impactScore: impactScoreFromLevel(item.impact) + (item.urgency === "high" ? 8 : 0),
    })
  }

  for (const item of input.needsAttention ?? []) {
    cards.push({
      id: `cc-attention-${item.id}`,
      headline: item.title,
      summary: item.summary,
      estimatedImpact: `${item.severity} priority`,
      ctaLabel: "Review",
      ctaHref: item.href ?? "/growth/os/approvals",
      impactScore: impactScoreFromLevel(item.severity),
    })
  }

  if (input.revenueDirector?.qaMarker === GROWTH_REVENUE_DIRECTOR_QA_MARKER) {
    const top = input.revenueDirector.workflowRequests[0]
    if (top && cards.length < ATTENTION_LIMIT) {
      cards.push({
        id: `rd-${top.id}`,
        headline: top.title,
        summary: top.summary,
        estimatedImpact: "High-value business move",
        ctaLabel: "Review",
        ctaHref: top.routeHint ?? "#top-business-move",
        impactScore: 95,
      })
    }
  }

  if (input.boundedAutonomousOutbound) {
    const waiting =
      input.boundedAutonomousOutbound.summary.approvedScopes -
      input.boundedAutonomousOutbound.summary.activeScopes
    if (waiting > 0) {
      cards.push({
        id: "outbound-scope-waiting",
        headline: "Outbound ready to activate",
        summary: `${waiting} approved scope${waiting === 1 ? "" : "s"} waiting for your go-ahead.`,
        estimatedImpact: "Unlocks the next outreach wave when you are ready",
        ctaLabel: "Review",
        ctaHref: "/growth/os/approvals",
        impactScore: 85,
      })
    }
  }

  const readyCalibration =
    input.adaptiveCalibration?.proposals.filter((row) => row.status === "approved").length ?? 0
  const pendingCalibration =
    input.adaptiveCalibration?.proposals.filter((row) => row.status === "pending").length ?? 0
  if ((readyCalibration > 0 || pendingCalibration > 0) && cards.length >= ATTENTION_LIMIT) {
    // Learning items surface in AI Improvements — not exceptions queue
  } else if (pendingCalibration > 0 && cards.length < ATTENTION_LIMIT) {
    cards.push({
      id: "calibration-review",
      headline: "AI improvement ready for review",
      summary: `${pendingCalibration} improvement ${pendingCalibration === 1 ? "proposal needs" : "proposals need"} your review.`,
      estimatedImpact: "Refines how AI prioritizes and reaches out",
      ctaLabel: "Review",
      ctaHref: "/growth/os/approvals",
      impactScore: 55,
    })
  }

  if (input.humanApprovalCenter?.qaMarker === GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER) {
    if (input.humanApprovalCenter.summary.totalPending > 0 && cards.length < ATTENTION_LIMIT) {
      const summary = input.humanApprovalCenter.summary
      cards.push({
        id: "hac-backlog",
        headline: "Items waiting on your approval",
        summary: teammatePreparedSummary(teammate, summary.totalPending, "item"),
        estimatedImpact: "Revenue unblocks when you review",
        ctaLabel: "Review exceptions",
        ctaHref: summary.approvalCenterHref,
        impactScore: 80,
      })
    }
  }

  for (const blocker of input.dailyBriefing.blockers.slice(0, 2)) {
    cards.push({
      id: `blocker-${blocker.id}`,
      headline: blocker.title,
      summary: blocker.reason,
      estimatedImpact: `${blocker.impact} impact blocker`,
      ctaLabel: blocker.linkLabel ?? "Resolve",
      ctaHref: blocker.href ?? "/growth/os",
      impactScore: impactScoreFromLevel(blocker.impact) + 5,
    })
  }

  const deduped = new Map<string, GrowthAiOsOperatorAttentionCard>()
  for (const card of cards.sort((a, b) => b.impactScore - a.impactScore)) {
    if (!deduped.has(card.headline)) deduped.set(card.headline, card)
  }

  return Array.from(deduped.values()).slice(0, ATTENTION_LIMIT)
}

function buildAiWorking(
  dashboard: AiOsOperationsDashboardReadModel,
  closedLoopLearning: GrowthClosedLoopLearningReadModel | undefined,
  teammate: AiTeammatePresentation,
): GrowthAiOsOperatorWorkingItem[] {
  const exec = dashboard.executionAgentStatus
  const outreach = dashboard.outreachAgentStatus
  const meeting = dashboard.meetingAgentStatus
  const items: GrowthAiOsOperatorWorkingItem[] = []

  if (exec.activeExecutions > 0 || exec.queuedExecutions > 0) {
    const count = exec.activeExecutions + exec.queuedExecutions
    items.push({
      id: "research",
      label: teammatePresenceLabel(
        teammate,
        `researching ${count} ${count === 1 ? "company" : "companies"}`,
      ),
      count,
    })
  }

  if (outreach.approvalPackagesWaiting > 0 || outreach.draftsPrepared > 0) {
    const count = Math.max(outreach.approvalPackagesWaiting, outreach.draftsPrepared)
    items.push({
      id: "outreach",
      label: teammatePresenceLabel(teammate, `preparing ${count} outreach ${count === 1 ? "draft" : "drafts"}`),
      count,
    })
  }

  if (meeting.preparationPackagesWaiting > 0 || meeting.briefsPrepared > 0) {
    const count = Math.max(meeting.preparationPackagesWaiting, 1)
    items.push({
      id: "meetings",
      label: teammatePresenceLabel(teammate, `preparing ${count} meeting ${count === 1 ? "brief" : "briefs"}`),
      count: meeting.preparationPackagesWaiting || meeting.briefsPrepared,
    })
  }

  const monitoring = dashboard.activeObjectives.length
  if (monitoring > 0) {
    items.push({
      id: "campaigns",
      label: teammatePresenceLabel(
        teammate,
        `monitoring ${monitoring} active ${monitoring === 1 ? "objective" : "objectives"}`,
      ),
      count: monitoring,
    })
  }

  if ((closedLoopLearning?.summary.insightsGenerated ?? 0) > 0) {
    items.push({
      id: "learning",
      label: teammatePresenceLabel(teammate, "learning from recent replies and outcomes"),
      count: null,
    })
  }

  for (const work of dashboard.activeWork.slice(0, 3)) {
    if (items.length >= 5) break
    const label = teammatePresenceLabel(teammate, work.summary || work.title)
    if (items.some((row) => row.label === label)) continue
    items.push({ id: work.id, label, count: null })
  }

  if (items.length === 0) {
    items.push({
      id: "idle",
      label: teammatePresenceLabel(teammate, "standing by for your next priority"),
      count: null,
    })
  }

  return items.slice(0, 5)
}

function buildBusinessSnapshot(
  dashboard: AiOsOperationsDashboardReadModel,
  revenueDirector?: GrowthRevenueDirectorReadModel,
): GrowthAiOsOperatorBusinessMetric[] {
  const kpis = revenueDirector?.qaMarker === GROWTH_REVENUE_DIRECTOR_QA_MARKER ? revenueDirector.kpis : null
  const topObjective = dashboard.activeObjectives[0]
  const topMission = dashboard.missionPriorities[0]

  return [
    {
      id: "pipeline",
      label: "Pipeline",
      value: kpis ? `${kpis.activeMissions} active missions` : `${dashboard.activeWork.length} in motion`,
      trendLabel: kpis && kpis.stalledMissions > 0 ? `${kpis.stalledMissions} stalled` : null,
    },
    {
      id: "meetings",
      label: "Meetings",
      value: `${dashboard.meetingAgentStatus.briefsPrepared} briefs prepared`,
      trendLabel:
        dashboard.meetingAgentStatus.preparationPackagesWaiting > 0
          ? `${dashboard.meetingAgentStatus.preparationPackagesWaiting} awaiting review`
          : null,
    },
    {
      id: "forecast",
      label: "Revenue Forecast",
      value: topObjective?.completionForecastLabel ?? "On track",
      trendLabel: topObjective?.stalled ? "Objective stalled" : null,
    },
    {
      id: "response",
      label: "Response Rate",
      value: revenueDirector?.resourceAllocation.communicationTopChannel
        ? `Top channel: ${revenueDirector.resourceAllocation.communicationTopChannel}`
        : "Collecting signal",
      trendLabel: null,
    },
    {
      id: "qualified",
      label: "Qualified Opportunities",
      value: `${dashboard.missionPriorities.length} ranked`,
      trendLabel: topMission ? `#1 ${topMission.missionLabel}` : null,
    },
    {
      id: "objectives",
      label: "Objectives Progress",
      value: topObjective ? `${topObjective.progressPercent}%` : "—",
      trendLabel: topObjective?.title ?? null,
    },
  ]
}

function buildAiImprovements(
  input: GrowthAiOsOperatorExperienceInput,
  teammate: AiTeammatePresentation,
): GrowthAiOsOperatorAiImprovement[] {
  const items: GrowthAiOsOperatorAiImprovement[] = []

  const advisory = input.communicationEngine?.learningAdvisory?.advisoryNote
  if (advisory) {
    items.push({
      id: "channel-learning",
      headline: `${teammate.name} learned which outreach channel is working best`,
      detail: advisory,
      reviewHref: null,
    })
  }

  const readyCalibration =
    input.adaptiveCalibration?.proposals.filter((row) => row.status === "approved").length ?? 0
  if (readyCalibration > 0) {
    items.push({
      id: "calibration-ready",
      headline: `${teammate.name} has ${readyCalibration} improvement${readyCalibration === 1 ? "" : "s"} ready for review`,
      detail: `Reviewing these updates helps ${teammate.name} prioritize and personalize outreach.`,
      reviewHref: "/growth/os/approvals",
    })
  }

  if ((input.closedLoopLearning?.summary.insightsGenerated ?? 0) > 0) {
    items.push({
      id: "closed-loop",
      headline: teammatePresenceLabel(teammate, "learning from recent replies and outcomes"),
      detail: "Patterns from the last cycle will shape the next recommendations.",
      reviewHref: null,
    })
  }

  if (items.length === 0) {
    items.push({
      id: "default",
      headline: `${teammate.name} is continuously learning from your market`,
      detail: `Improvements will appear here when ${teammate.name} finds a meaningful pattern.`,
      reviewHref: null,
    })
  }

  return items.slice(0, 3)
}

function buildSystemStatus(dashboard: AiOsOperationsDashboardReadModel): GrowthAiOsOperatorSystemStatus {
  const health = dashboard.healthSummary
  const tone = healthTone(health.overallStatus)

  if (health.blockedAgentsCount > 0) {
    return {
      tone: "critical",
      headline: `${health.blockedAgentsCount} agent${health.blockedAgentsCount === 1 ? "" : "s"} need attention`,
      detail: health.agentHealthLabel,
    }
  }

  if (health.overallStatus === "degraded") {
    return {
      tone: "attention",
      headline: "Some systems need a quick check",
      detail: health.queueHealthLabel !== "Healthy" ? health.queueHealthLabel : health.runtimeHealthLabel,
    }
  }

  if (health.schedulerReadinessLabel.toLowerCase().includes("blocked")) {
    return {
      tone: "attention",
      headline: "Mailbox warmup requires attention",
      detail: health.schedulerReadinessLabel,
    }
  }

  return {
    tone,
    headline: tone === "healthy" ? "Everything operating normally" : "Review recommended",
    detail: dashboard.executiveOverview.safeModeLabel !== "Off" ? dashboard.executiveOverview.safeModeLabel : null,
  }
}

export function synthesizeGrowthAiOsOperatorExperience(
  input: GrowthAiOsOperatorExperienceInput,
): GrowthAiOsOperatorExperienceViewModel {
  const { dashboard, dailyBriefing } = input
  const teammate = input.teammate ?? defaultTeammatePresentation()
  const timelineSource = [
    ...dashboard.activityTimeline.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      occurredAt: row.occurredAt,
      href: row.href,
      eventType: null as string | null,
    })),
  ]

  const timeline = timelineSource
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, TIMELINE_LIMIT)
    .map((row) => {
      const translated = translateOperatorActivityHeadline({
        title: row.title,
        summary: row.summary,
        eventType: row.eventType,
      })
      return {
        id: row.id,
        timeLabel: formatOperatorTimelineTime(row.occurredAt),
        occurredAt: row.occurredAt,
        headline: translated.headline,
        rawTitle: translated.rawTitle,
        href: row.href,
      }
    })

  const revenueDirector = input.revenueDirector
  const topRequest =
    revenueDirector?.qaMarker === GROWTH_REVENUE_DIRECTOR_QA_MARKER
      ? revenueDirector.workflowRequests[0]
      : null

  const revenueRecommendationFromDirector = topRequest
    ? {
        id: topRequest.id,
        headline: topRequest.title,
        reasons: topRequest.evidence.slice(0, 3).map((row) => row.label),
        estimatedValue:
          revenueDirector?.executiveSummary.primaryFocus ??
          revenueDirector?.resourceAllocation.topObjectiveTitle ??
          null,
        reviewHref: topRequest.routeHint ?? "#top-business-move",
        dismissible: true as const,
        workflowRequestId: topRequest.ledgerRequestId ?? topRequest.id,
      }
    : null

  const revenueRecommendation =
    input.nativeRevenueDecisionRecommendation ?? revenueRecommendationFromDirector

  const hac = input.humanApprovalCenter
  const approvalSummary =
    hac?.qaMarker === GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER
      ? {
          totalPending: hac.summary.totalPending,
          groups: [
            ...(hac.summary.emailPending > 0
              ? [{ id: "ready-to-send", label: AI_OS_APPROVAL_OUTCOME_BUCKETS.readyToSend, count: hac.summary.emailPending }]
              : []),
            ...( (hac.filterCounts.bySource.execution_plan ?? 0) > 0
              ? [
                  {
                    id: "ready-to-activate",
                    label: AI_OS_APPROVAL_OUTCOME_BUCKETS.readyToActivate,
                    count: hac.filterCounts.bySource.execution_plan ?? 0,
                  },
                ]
              : []),
            ...( (hac.filterCounts.bySource.autonomous_outbound_scope ?? 0) > 0
              ? [
                  {
                    id: "needs-review",
                    label: AI_OS_APPROVAL_OUTCOME_BUCKETS.needsReview,
                    count: hac.filterCounts.bySource.autonomous_outbound_scope ?? 0,
                  },
                ]
              : []),
          ].filter((row) => row.count > 0),
          approvalCenterHref: hac.summary.approvalCenterHref,
          canApproveAllEligible: false as const,
        }
      : null

  const comm = input.communicationEngine
  const topPlan = comm?.qaMarker === GROWTH_COMMUNICATION_ENGINE_QA_MARKER ? comm.plans[0] : null
  const outreachRecommendation =
    comm?.qaMarker === GROWTH_COMMUNICATION_ENGINE_QA_MARKER
      ? {
          primaryChannel: comm.summary.topChannel ?? topPlan?.steps[0]?.channel ?? "Email",
          secondaryChannel:
            topPlan?.steps.find((step) => step.channel !== comm.summary.topChannel)?.channel ?? "LinkedIn",
          reason:
            comm.learningAdvisory?.advisoryNote ??
            "Highest expected response rate based on recent outcomes.",
          draftHref: topPlan?.routeHints[0]?.href ?? null,
          evidenceAvailable: Boolean(topPlan && topPlan.steps.length > 0),
        }
      : null

  return {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_OPERATOR_EXPERIENCE_QA_MARKER,
    generatedAt: dashboard.generatedAt,
    executiveBrief: buildExecutiveBrief(dashboard, dailyBriefing, teammate),
    needsAttention: buildAttentionCards(input, teammate),
    aiWorking: buildAiWorking(dashboard, input.closedLoopLearning, teammate),
    businessSnapshot: buildBusinessSnapshot(dashboard, revenueDirector),
    timeline,
    systemStatus: buildSystemStatus(dashboard),
    revenueRecommendation,
    approvalSummary,
    outreachRecommendation,
    aiImprovements: buildAiImprovements(input, teammate),
  }
}

/** Minimal fixture for UX-1A certification — no Command Center dependency. */
export function buildGrowthAiOsOperatorExperienceCertFixture(): GrowthAiOsOperatorExperienceInput {
  const generatedAt = "2026-06-25T09:00:00.000Z"
  const configureHref = "/growth/settings/autonomy" as const

  const agentStatusBase = {
    enabled: true,
    controlState: "enabled" as const,
    configureHref,
    budgetLabel: "Within budget",
  }

  const dashboard: AiOsOperationsDashboardReadModel = {
    readOnly: true,
    qaMarker: GROWTH_AI_OS_OPERATIONS_DASHBOARD_QA_MARKER,
    generatedAt,
    executiveOverview: {
      dailyBriefingHeadline: "AI is on track today.",
      dailyBriefingSummary: "Research and qualification progressing.",
      aiHealthStatus: "healthy",
      aiHealthLabel: "Healthy",
      activeAutonomousRuns: 2,
      priorityWorkLabel: "Outreach approval",
      needsAttentionCount: 2,
      approvalBacklogCount: 3,
      safeModeLabel: "Off",
      operatingModeLabel: "Assisted autonomy",
      operatingModeReadOnly: true,
      configureHref,
    },
    autonomyState: {
      operatingModeLabel: "Assisted autonomy",
      autonomyEnabled: true,
      emergencyStopActive: false,
      safeModeActive: false,
      shadowModeEnabled: false,
      activeAutonomousAgents: ["research_agent"],
      configureHref,
    },
    executionAgentStatus: {
      ...agentStatusBase,
      eligiblePlans: 5,
      queuedExecutions: 3,
      activeExecutions: 2,
      completedExecutions: 24,
      failedExecutions: 0,
      blockedExecutions: 0,
      latestEventSummary: "Research completed for Precision Biomedical",
    },
    outreachAgentStatus: {
      ...agentStatusBase,
      draftsPrepared: 5,
      approvalPackagesWaiting: 7,
      blockedPreparations: 0,
      eligibleLeads: 12,
      latestPreparedAssetSummary: "Outreach draft created",
    },
    meetingAgentStatus: {
      ...agentStatusBase,
      briefsPrepared: 2,
      preparationPackagesWaiting: 1,
      blockedPreparations: 0,
      eligibleLeads: 4,
      latestPreparedAssetSummary: "Meeting brief prepared",
      lastRunSummary: null,
    },
    activeWork: [
      {
        id: "work-1",
        category: "autonomous_research",
        title: "Research queue",
        summary: "Researching Precision Biomedical",
        href: null,
      },
    ],
    activityTimeline: [
      {
        id: "act-1",
        source: "autonomous_research",
        title: "Research completed for Precision Biomedical",
        summary: "Qualification score increased",
        occurredAt: "2026-06-25T09:02:00.000Z",
        href: null,
      },
      {
        id: "act-2",
        source: "workflow",
        title: "Growth Communication Plan Generated",
        summary: "Waiting for approval",
        occurredAt: "2026-06-25T09:12:00.000Z",
        href: null,
      },
    ],
    healthSummary: {
      overallStatus: "healthy",
      agentHealthLabel: "Healthy",
      runtimeHealthLabel: "Healthy",
      queueHealthLabel: "Healthy",
      schedulerReadinessLabel: "Ready",
      budgetUsageLabel: "Low",
      safeModeLabel: "Off",
      blockedAgentsCount: 0,
    },
    approvalSummary: {
      totalCount: 8,
      categories: [],
    },
    missionPriorities: [
      {
        rank: 1,
        priorityLabel: "Today",
        ownerAgent: "research_agent" as import("@/lib/growth/aios/growth/growth-agent-framework-types").GrowthAgentKind,
        missionLabel: "Precision Biomedical",
        roiLabel: "high",
        urgency: "high",
        blockers: [],
        href: null,
        queueBucket: "today",
      },
    ],
    activeObjectives: [
      {
        objectiveId: "obj-1",
        title: "Book 10 meetings",
        progressPercent: 42,
        aiContributionLabel: "AI researched 24 companies",
        stalled: false,
        completionForecastLabel: "On track",
        href: "/growth/objectives",
      },
    ],
    engineeringDiagnostics: [],
    dailyBriefing: {
      readOnly: true,
      qaMarker: GROWTH_AI_OS_DAILY_BRIEFING_QA_MARKER,
      briefingId: "brief-cert",
      generatedAt,
      executiveHeadline: "Good progress today",
      whatChangedSummary: "Research and drafts increased",
      topPriorities: [],
      needsApproval: [
        {
          id: "na-1",
          title: "Approve Outreach Campaign",
          reason: "High-value prospect ready for review",
          impact: "high",
          urgency: "high",
          href: "/growth/os/approvals",
          linkLabel: "Review",
        },
      ],
      blockers: [],
      recentWins: [],
      risks: [],
      recommendedNextActions: [
        {
          id: "rec-1",
          title: "Review Recommended Actions",
          reason: "Top priority for today",
          impact: "high",
          urgency: "medium",
          href: "/growth/os/approvals",
          linkLabel: "Review",
        },
      ],
      suggestedLinks: [],
    },
  }

  return {
    dashboard,
    dailyBriefing: dashboard.dailyBriefing,
    needsAttention: [
      {
        id: "att-1",
        kind: "approval_required",
        title: "High-value Prospect Needs Review",
        summary: "Precision Biomedical shows strong buying signals.",
        severity: "high",
        missionId: null,
        workOrderId: null,
        leadId: null,
        href: "/growth/os/approvals",
      },
    ],
  }
}
