/** GE-AI-UX-1C / GE-AI-UX-2A / GE-AI-UX-3A / GE-AI-UX-4A — Home executive briefing synthesizer (client-safe). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  AI_OS_HOME_PRIMARY_CTA,
  AI_OS_HOME_SECONDARY_CTA,
} from "@/lib/workspace/ai-os-outcome-first-terminology"
import {
  AI_EMPLOYEE_CHECK_IN_FOCUS_INTRO,
  AI_EMPLOYEE_REVIEW_BUCKETS,
  AI_EMPLOYEE_WORK_SUMMARY_CATEGORIES,
  employeeNeedsHelpLine,
} from "@/lib/workspace/ai-employee-experience"
import { translateHomeTimelineFirstPerson } from "@/lib/growth/workspace/executive-briefing/growth-home-employee-voice"
import {
  buildBusinessAwareness,
  buildInitiativeRecommendations,
  buildWatchingItems,
} from "@/lib/growth/workspace/executive-briefing/growth-home-proactive-initiative-synthesizer"
import {
  buildAccomplishmentGroups,
  buildAiWorkload,
  buildBiggestRiskFeatured,
  buildBiggestWin,
  buildExecutiveRecommendation,
  buildMyPriorities,
  buildOwnershipFoundObservations,
  buildOwnershipThingsNoticed,
  buildWaitingOnYou,
  buildWeeklyGoals,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer"
import { AI_PROACTIVE_FOUND_INTRO, proactiveCalmLine } from "@/lib/workspace/ai-proactive-initiative"
import {
  defaultTeammatePresentation,
  teammateAttributeOutcomes,
  teammateExceptionSummary,
  teammateHandledRest,
  teammateHealthHandledLabel,
  teammateHomeIntro,
  teammatePresenceLabel,
} from "@/lib/workspace/ai-teammate-voice"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  buildCustomerHealth,
  buildCustomerSuccessMissions,
  buildCustomerSuccessOperatorVoice,
  buildCustomerWins,
  buildCsContribution,
  buildExpansionOpportunities,
  buildRenewalsMonitoring,
  type GrowthHomeCustomerSuccessMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-customer-success-mission-synthesizer"
import {
  buildAudienceIntelligence,
  buildCampaignPerformance,
  buildContentPreparing,
  buildMarketingContribution,
  buildMarketingMissions,
  buildMarketingOperatorVoice,
  type GrowthHomeMarketingMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-marketing-mission-synthesizer"
import {
  buildActiveRevenueMissions,
  buildMissionHealthSummaries,
  buildMissionTimeline,
  buildNextPlannedActions,
  buildRevenueForecast,
  type GrowthHomeRevenueMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer"
import {
  buildContinuityOpening,
  buildDailyBriefing,
  buildMilestones,
  buildOurProgress,
  buildRecommendationContinuity,
  buildSinceWeLastMet,
  buildTrustExplanations,
  buildWhatChanged,
  type GrowthHomeContinuityInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-continuity-synthesizer"
import type {
  GrowthWorkspaceContinueItem,
  GrowthWorkspaceRecentView,
} from "@/lib/growth/workspace/growth-workspace-activity-memory"
import {
  formatHomeCurrency,
  formatHomeRevenueRange,
  greetingForHour,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type {
  GrowthHomeActivityGroup,
  GrowthHomeAiEmployeeStatus,
  GrowthHomeApprovalSummary,
  GrowthHomeAttentionItem,
  GrowthHomeBusinessMetric,
  GrowthHomeCheckIn,
  GrowthHomeCompletedTodayItem,
  GrowthHomeExecutiveBrief,
  GrowthHomeExecutiveBriefingViewModel,
  GrowthHomeHealthTone,
  GrowthHomeNeedsReview,
  GrowthHomeRecommendation,
  GrowthHomeTimelinePeriod,
  GrowthHomeWorkingOnItem,
  GrowthHomeWorkSummaryCategory,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { operatorMissionSummary } from "@/lib/workspace/ai-autonomous-revenue-operator"
import { marketingOperatorSummary } from "@/lib/workspace/ai-autonomous-marketing-operator"
import { customerSuccessOperatorSummary } from "@/lib/workspace/ai-autonomous-customer-success-operator"
import { serviceOperatorSummary } from "@/lib/workspace/ai-autonomous-service-operator"
import {
  buildOperationalInsights,
  buildServiceContribution,
  buildServiceFollowUps,
  buildServiceHealth,
  buildServiceMissions,
  buildServiceOperatorVoice,
  buildTechnicianAwareness,
  countTotalServiceMissions,
  type GrowthHomeServiceMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-service-mission-synthesizer"
import { buildAiOsUxViewModel } from "@/lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import {
  hasCanonicalDailyWorkQueue,
  pickTopCanonicalQueueActionItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-canonical-queue-mapper"
import { AIDEN_DAILY_BRIEFING_QA_MARKER } from "@/lib/growth/aiden/aiden-daily-briefing"
import { GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

const ATTENTION_LIMIT = 5
const BUSINESS_SNAPSHOT_LIMIT = 6

export type GrowthHomeExecutiveBriefingInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  recentViews?: GrowthWorkspaceRecentView[]
  continueItems?: GrowthWorkspaceContinueItem[]
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
  teammate?: AiTeammatePresentation
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

function deriveHealthTone(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeHealthTone {
  const briefing = dashboard.briefing
  if (
    (briefing?.mailbox.expired_mailboxes ?? 0) > 0 ||
    (briefing?.summary.blocked_jobs ?? 0) > 0
  ) {
    return "critical"
  }
  if (
    (briefing?.mailbox.warnings ?? 0) > 0 ||
    (briefing?.summary.replies_needing_attention ?? 0) > 0 ||
    (briefing?.summary.pending_approvals ?? 0) > 3
  ) {
    return "attention"
  }
  return "healthy"
}

function deriveHealthLabel(tone: GrowthHomeHealthTone, dashboard: GrowthWorkspaceDashboardViewModel): string {
  const mailbox = dashboard.briefing?.summary.mailbox_label ?? "Unknown"
  if (tone === "healthy") return "Operations look healthy"
  if (tone === "critical") {
    if ((dashboard.briefing?.mailbox.expired_mailboxes ?? 0) > 0) return "Mailbox needs reconnection"
    return "Blocked work requires attention"
  }
  if (mailbox === "Warning") return "Mailbox needs a quick check"
  return "A few items need your review"
}

function buildCompletedOutcomes(dashboard: GrowthWorkspaceDashboardViewModel): string[] {
  const briefing = dashboard.briefing
  const outcomes: string[] = []

  const hotCompanies = metricValue(dashboard, "intelligence", "Hot companies")
  const leadsNeedingAction = metricValue(dashboard, "my-queue", "Leads needing action")
  const researched = hotCompanies + leadsNeedingAction + (briefing?.revenue.opportunities ?? 0)
  if (researched > 0) {
    outcomes.push(`Researched ${researched} ${pluralize(researched, "company", "companies")}.`)
  }

  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const openOpps = metricValue(dashboard, "pipeline-snapshot", "Open opportunities")
  const qualified = callReady + closeCandidates
  if (qualified > 0) {
    outcomes.push(`Qualified ${qualified} ${pluralize(qualified, "opportunity", "opportunities")}.`)
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const campaignsPrepared = Math.max(activeCampaigns, pendingDrafts)
  if (campaignsPrepared > 0) {
    outcomes.push(`Prepared ${campaignsPrepared} personalized ${pluralize(campaignsPrepared, "campaign", "campaigns")}.`)
  }

  const meetingsBooked = Math.max(
    briefing?.meetings.meetings_this_week ?? 0,
    briefing?.summary.meetings_today ?? 0,
    metricValue(dashboard, "activity", "Meetings today"),
  )
  if (meetingsBooked > 0) {
    outcomes.push(`Booked ${meetingsBooked} ${pluralize(meetingsBooked, "meeting", "meetings")}.`)
  }

  const advanced = Math.min(closeCandidates, openOpps)
  if (advanced > 0) {
    outcomes.push(`Advanced ${advanced} ${pluralize(advanced, "opportunity", "opportunities")} toward proposal.`)
  }

  const revenue = briefing?.revenue.revenue ?? 0
  if (revenue > 0) {
    outcomes.push(`Closed 1 deal worth ${formatHomeCurrency(revenue)}.`)
  } else {
    const executions = metricValue(dashboard, "campaign-snapshot", "Executions today")
    if (executions > 0 && outcomes.length < 6) {
      outcomes.push(`Completed ${executions} outreach ${pluralize(executions, "action", "actions")} today.`)
    }
  }

  if (outcomes.length === 0) {
    outcomes.push("Is monitoring your market and inbox for the next opportunity.")
  }

  return outcomes.slice(0, 6)
}

function buildExecutiveBrief(
  dashboard: GrowthWorkspaceDashboardViewModel,
  teammate: AiTeammatePresentation,
  exceptionCount: number,
): GrowthHomeExecutiveBrief {
  const briefing = dashboard.briefing
  const hour = new Date(dashboard.generatedAt).getHours()
  const operatorName = dashboard.welcome.operatorName ?? briefing?.operator_name ?? null
  const greetingBase = briefing?.greeting ?? greetingForHour(hour)
  const greeting =
    operatorName && !greetingBase.includes(operatorName)
      ? `${greetingBase}, ${operatorName}.`
      : `${greetingBase}.`

  const tone = deriveHealthTone(dashboard)
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const forecastValue = metricValue(dashboard, "pipeline-snapshot", "Forecast value")
  const pipelineEstimate = Math.max(weightedPipeline, forecastValue)

  const positiveReplies = briefing?.inbox.positive_interest ?? 0
  const meetingsBooked = briefing?.meetings.meetings_this_week ?? briefing?.summary.meetings_today ?? 0
  const hotCompanies = metricValue(dashboard, "intelligence", "Hot companies")

  let biggestWin: GrowthHomeExecutiveBrief["biggestWin"] = null
  if (meetingsBooked > 0) {
    biggestWin = {
      headline: `${meetingsBooked} ${pluralize(meetingsBooked, "meeting", "meetings")} on the calendar`,
      detail: sanitizeHomeNarrative(briefing?.section_summaries.meetings ?? "Prospects are moving toward conversations."),
    }
  } else if (positiveReplies > 0) {
    biggestWin = {
      headline: `${positiveReplies} positive ${pluralize(positiveReplies, "reply", "replies")}`,
      detail: "Prospects are engaging with your outreach.",
    }
  } else if (hotCompanies > 0) {
    biggestWin = {
      headline: `${hotCompanies} high-intent ${pluralize(hotCompanies, "account", "accounts")}`,
      detail: "Recent engagement signals show strong buying interest.",
    }
  }

  let biggestRisk: GrowthHomeExecutiveBrief["biggestRisk"] = null
  if ((briefing?.mailbox.expired_mailboxes ?? 0) > 0) {
    biggestRisk = {
      headline: "Mailbox disconnected",
      detail: sanitizeHomeNarrative(briefing?.section_summaries.mailbox ?? "Reconnect before approving sends."),
    }
  } else if ((briefing?.summary.blocked_jobs ?? 0) > 0) {
    biggestRisk = {
      headline: `${briefing?.summary.blocked_jobs} blocked ${pluralize(briefing?.summary.blocked_jobs ?? 0, "job", "jobs")}`,
      detail: sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? "Review blocked work before it stalls pipeline momentum."),
    }
  } else if ((briefing?.summary.replies_needing_attention ?? 0) > 0) {
    const count = briefing?.summary.replies_needing_attention ?? 0
    biggestRisk = {
      headline: `${count} ${pluralize(count, "reply", "replies")} need a response`,
      detail: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Timely follow-up protects deal momentum."),
    }
  }

  const todaysPriority =
    sanitizeHomeNarrative(
      dashboard.welcome.todaysFocus ??
        briefing?.priorities?.[0]?.title ??
        dashboard.welcome.recommendedAction ??
        "Keep outreach, inbox, and pipeline moving.",
    )

  const primaryPriority = briefing?.priorities?.[0]
  const suggestedNextAction = {
    label: primaryPriority?.title ?? dashboard.welcome.recommendedAction ?? "Review your queue",
    href: primaryPriority?.href ?? metricHref(dashboard, "my-queue", "Leads needing action"),
  }

  const completedOutcomes = teammateAttributeOutcomes(teammate, buildCompletedOutcomes(dashboard))
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")

  const exceptionsHref =
    metricValue(dashboard, "campaign-snapshot", "Approval queue") > 0
      ? metricHref(dashboard, "campaign-snapshot", "Approval queue")
      : metricHref(dashboard, "my-queue", "Leads needing action")

  const pronoun = teammate.subjectPronoun

  return {
    greeting,
    introLine: teammateHomeIntro(teammate),
    teammateName: teammate.name,
    teammateRole: teammate.role,
    completedOutcomes,
    exceptionCount,
    exceptionSummary: teammateExceptionSummary(teammate, exceptionCount),
    handledRestSummary: teammateHandledRest(teammate),
    overallHealth: {
      tone,
      label: tone === "healthy" ? teammateHealthHandledLabel(teammate) : deriveHealthLabel(tone, dashboard),
      summary: sanitizeHomeNarrative(
        briefing?.section_summaries.revenue ??
          `${teammate.name} prepared outreach, advanced pipeline, and flagged only what needs you.`,
      ),
    },
    meetingsBookedSummary:
      meetingsBooked > 0
        ? `${pronoun} booked ${meetingsBooked} ${pluralize(meetingsBooked, "meeting", "meetings")}.`
        : null,
    opportunitiesAdvancedSummary:
      closeCandidates > 0
        ? `${pronoun} advanced ${closeCandidates} ${pluralize(closeCandidates, "opportunity", "opportunities")}.`
        : null,
    revenueImpactSummary:
      pipelineEstimate > 0 ? `Estimated pipeline impact: ${formatHomeCurrency(pipelineEstimate)}` : null,
    estimatedBusinessImpact: pipelineEstimate > 0 ? formatHomeCurrency(pipelineEstimate) : null,
    primaryCta: { label: AI_OS_HOME_PRIMARY_CTA, href: exceptionsHref },
    secondaryCta: {
      label: AI_OS_HOME_SECONDARY_CTA,
      href: `${GROWTH_WORKSPACE_BASE_PATH}#ai-work-summary`,
    },
    progressSinceLastVisit: completedOutcomes,
    biggestWin,
    biggestRisk,
    todaysPriority,
    suggestedNextAction,
  }
}

function buildExceptions(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAttentionItem[] {
  const items: GrowthHomeAttentionItem[] = []

  for (const card of dashboard.operatorActionCards.slice(0, 4)) {
    items.push({
      id: card.id,
      headline: card.title,
      summary: sanitizeHomeNarrative(card.description),
      ctaLabel: "Review",
      ctaHref: card.href,
      impactScore: card.id.includes("approve") ? 90 : card.id.includes("review") ? 75 : 50,
    })
  }

  for (const priority of dashboard.briefing?.priorities?.slice(0, 2) ?? []) {
    items.push({
      id: `priority-${priority.priority}`,
      headline: priority.title,
      summary: sanitizeHomeNarrative(priority.detail),
      ctaLabel: "Open",
      ctaHref: priority.href,
      impactScore: 100 - priority.priority * 10,
    })
  }

  const deduped = new Map<string, GrowthHomeAttentionItem>()
  for (const item of items.sort((a, b) => b.impactScore - a.impactScore)) {
    if (!deduped.has(item.id)) deduped.set(item.id, item)
  }

  return [...deduped.values()].slice(0, ATTENTION_LIMIT)
}

function buildRecommendations(dashboard: GrowthWorkspaceDashboardViewModel): {
  primary: GrowthHomeRecommendation | null
  additional: GrowthHomeRecommendation[]
} {
  if (
    hasCanonicalDailyWorkQueue(dashboard) &&
    dashboard.dailyRevenueWorkQueue &&
    dashboard.dailyRevenueWorkQueueDisplay
  ) {
    const top = pickTopCanonicalQueueActionItem(
      dashboard.dailyRevenueWorkQueue,
      dashboard.dailyRevenueWorkQueueDisplay,
    )
    if (top) {
      return {
        primary: {
          id: `rec-queue-${top.leadId}`,
          headline: `Start with ${top.companyName}`,
          whyItMatters: top.reasoning || `${top.actionLabel} is the highest-ranked item in today's revenue queue.`,
          expectedImpact: `${top.actionLabel} via ${top.channelLabel}`,
          estimatedRevenue: null,
          timeRequired: "About 10 minutes",
          primaryCtaLabel: top.requiresHumanApproval ? "Review and approve" : "Take action",
          primaryCtaHref: top.href,
          dismissible: true,
        },
        additional: [],
      }
    }
  }

  const recommendations: GrowthHomeRecommendation[] = []
  const briefing = dashboard.briefing
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const low = Math.round(weightedPipeline * 0.15)
  const high = Math.round(weightedPipeline * 0.18)

  for (const priority of briefing?.priorities ?? []) {
    recommendations.push({
      id: `rec-priority-${priority.priority}`,
      headline: priority.title,
      whyItMatters: sanitizeHomeNarrative(priority.detail),
      expectedImpact:
        weightedPipeline > 0
          ? `2–4 meetings · ${formatHomeRevenueRange(Math.round(weightedPipeline * 0.12), Math.round(weightedPipeline * 0.24))} pipeline`
          : "Keeps revenue momentum on track",
      estimatedRevenue: weightedPipeline > 0 ? formatHomeRevenueRange(low, high) || null : null,
      timeRequired: priority.priority === 1 ? "About 10 minutes" : "About 15 minutes",
      primaryCtaLabel: "Take action",
      primaryCtaHref: priority.href,
      dismissible: true,
    })
  }

  if (recommendations.length === 0 && dashboard.welcome.recommendedAction) {
    recommendations.push({
      id: "rec-welcome",
      headline: sanitizeHomeNarrative(dashboard.welcome.recommendedAction),
      whyItMatters: "This is the highest-impact move based on your current queue.",
      expectedImpact: "Clears friction and unlocks the next outreach wave",
      estimatedRevenue: weightedPipeline > 0 ? formatHomeCurrency(Math.round(weightedPipeline * 0.12)) : null,
      timeRequired: "About 10 minutes",
      primaryCtaLabel: "Review recommendation",
      primaryCtaHref: metricHref(dashboard, "my-queue", "Leads needing action"),
      dismissible: true,
    })
  }

  return {
    primary: recommendations[0] ?? null,
    additional: recommendations.slice(1, 4),
  }
}

function buildAiActivity(
  dashboard: GrowthWorkspaceDashboardViewModel,
  teammate: AiTeammatePresentation,
): GrowthHomeActivityGroup[] {
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const campaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const approvals = metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const replies = metricValue(dashboard, "my-queue", "Inbox requiring replies")
  const relationships = metricValue(dashboard, "intelligence", "Relationship alerts")
  const meetings = metricValue(dashboard, "activity", "Meetings today")
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const conversations = metricValue(dashboard, "intelligence", "Conversation alerts")

  return [
    {
      id: "finding-opportunities",
      label: "Finding opportunities",
      summary:
        leads + hot > 0
          ? teammatePresenceLabel(
              teammate,
              `researching and prioritizing ${leads + hot} ${pluralize(leads + hot, "account", "accounts")}`,
            )
          : teammatePresenceLabel(teammate, "monitoring for new accounts to pursue"),
      count: leads + hot > 0 ? leads + hot : null,
      href: metricHref(dashboard, "my-queue", "Leads needing action"),
    },
    {
      id: "preparing-outreach",
      label: "Preparing outreach",
      summary:
        campaigns + approvals > 0
          ? teammatePresenceLabel(
              teammate,
              `preparing ${campaigns} active ${pluralize(campaigns, "campaign", "campaigns")} with ${approvals} awaiting approval`,
            )
          : teammatePresenceLabel(teammate, "standing by to prepare the next campaign wave"),
      count: campaigns + approvals > 0 ? campaigns + approvals : null,
      href: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
    },
    {
      id: "booking-meetings",
      label: "Booking meetings",
      summary:
        meetings + callReady > 0
          ? teammatePresenceLabel(
              teammate,
              `preparing and confirming ${meetings + callReady} upcoming ${pluralize(meetings + callReady, "meeting", "meetings")}`,
            )
          : teammatePresenceLabel(teammate, "ready when prospects request time on the calendar"),
      count: meetings + callReady > 0 ? meetings + callReady : null,
      href: metricHref(dashboard, "activity", "Meetings today"),
    },
    {
      id: "advancing-deals",
      label: "Advancing deals",
      summary:
        replies + relationships + conversations > 0
          ? teammatePresenceLabel(
              teammate,
              `following up on ${replies + relationships + conversations} active ${pluralize(replies + relationships + conversations, "conversation", "conversations")}`,
            )
          : teammatePresenceLabel(teammate, "moving qualified opportunities through the pipeline"),
      count: replies + relationships + conversations > 0 ? replies + relationships + conversations : null,
      href: metricHref(dashboard, "pipeline-snapshot", "Open opportunities"),
    },
    {
      id: "learning",
      label: "Learning what works",
      summary: teammatePresenceLabel(teammate, "reviewing recent outcomes to improve the next recommendations"),
      count: null,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/engagement`,
    },
    {
      id: "monitoring-risk",
      label: "Monitoring risk",
      summary: teammatePresenceLabel(
        teammate,
        sanitizeHomeNarrative(
          dashboard.briefing?.section_summaries.mailbox ?? "watching sender health and deliverability",
        ).replace(/\.$/, ""),
      ),
      count: null,
      href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications/mailboxes`,
    },
  ]
}

function deriveEmployeeStatus(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAiEmployeeStatus {
  const briefing = dashboard.briefing
  const pendingApprovals = briefing?.summary.pending_approvals ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const campaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0

  if (pendingApprovals > 0) {
    return {
      kind: "waiting_for_approval",
      label: "Waiting for approval",
      activityLabel: "waiting for your approval on prepared outreach",
    }
  }
  if (repliesNeedingAttention > 0) {
    return {
      kind: "monitoring_replies",
      label: "Monitoring replies",
      activityLabel: "watching for replies that need follow-up",
    }
  }
  if (campaigns + pendingDrafts > 0) {
    return {
      kind: "preparing_outreach",
      label: "Preparing outreach",
      activityLabel: "preparing personalized outreach",
    }
  }
  if (leads + hot > 0) {
    return {
      kind: "researching",
      label: "Researching opportunities",
      activityLabel: "researching high-fit prospects",
    }
  }

  const hasRecentActivity =
    (briefing?.revenue.emails_sent ?? 0) > 0 ||
    metricValue(dashboard, "activity", "Emails sent today") > 0

  if (!hasRecentActivity && pendingApprovals === 0 && leads + hot === 0) {
    return {
      kind: "idle",
      label: "Idle",
      activityLabel: "standing by for the next priority",
    }
  }

  return {
    kind: "working",
    label: "Working",
    activityLabel: "advancing your revenue priorities",
  }
}

function buildFocusItems(dashboard: GrowthWorkspaceDashboardViewModel): string[] {
  const briefing = dashboard.briefing
  const items: string[] = []
  const positiveReplies = briefing?.inbox.positive_interest ?? 0
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const campaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingApprovals = briefing?.summary.pending_approvals ?? 0

  if (positiveReplies + repliesNeedingAttention > 0) {
    items.push("Following up with warm prospects")
  }
  if (repliesNeedingAttention > 0 || (briefing?.inbox.new_replies ?? 0) > 0) {
    items.push("Monitoring replies")
  }
  if (hot > 0) {
    items.push("Looking for new buying signals")
  }
  if (campaigns > 0 || pendingApprovals > 0) {
    items.push("Preparing the next outreach wave")
  }

  const priority = sanitizeHomeNarrative(
    dashboard.welcome.todaysFocus ??
      briefing?.priorities?.[0]?.title ??
      dashboard.welcome.recommendedAction ??
      "",
  )
  if (priority && items.length < 4) {
    items.push(priority.replace(/\.$/, ""))
  }

  if (items.length === 0) {
    items.push("Monitoring your market and inbox")
  }

  return [...new Set(items)].slice(0, 4)
}

const WORKING_ON_ACTIVE_LABELS: Record<string, string> = {
  "finding-opportunities": "Finding high-fit prospects",
  "preparing-outreach": "Preparing personalized outreach",
  "booking-meetings": "Coordinating meetings",
  "advancing-deals": "Advancing qualified opportunities",
  learning: "Learning from recent conversations",
  "monitoring-risk": "Monitoring campaign performance",
}

function buildWorkingOnNow(
  dashboard: GrowthWorkspaceDashboardViewModel,
  activityGroups: GrowthHomeActivityGroup[],
): GrowthHomeWorkingOnItem[] {
  const active = activityGroups
    .filter((group) => group.count !== null && group.count > 0)
    .map((group) => ({
      id: group.id,
      label: WORKING_ON_ACTIVE_LABELS[group.id] ?? group.label,
      href: group.href,
    }))

  if (active.length > 0) return active.slice(0, 5)

  const replies = metricValue(dashboard, "my-queue", "Inbox requiring replies")
  if (replies > 0) {
    return [
      {
        id: "watching-replies",
        label: "Watching for replies",
        href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
      },
    ]
  }

  return [
    {
      id: "monitoring",
      label: "Monitoring your market and inbox",
      href: metricHref(dashboard, "my-queue", "Leads needing action"),
    },
  ]
}

function buildCompletedToday(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeCompletedTodayItem[] {
  const briefing = dashboard.briefing
  const items: GrowthHomeCompletedTodayItem[] = []

  const hotCompanies = metricValue(dashboard, "intelligence", "Hot companies")
  const leadsNeedingAction = metricValue(dashboard, "my-queue", "Leads needing action")
  const researched = hotCompanies + leadsNeedingAction + (briefing?.revenue.opportunities ?? 0)
  if (researched > 0) {
    items.push({
      id: "research",
      category: "Research completed",
      label: "Research completed",
      detail: `${researched} ${pluralize(researched, "company", "companies")} researched`,
    })
  }

  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const qualified = callReady + closeCandidates
  if (qualified > 0) {
    items.push({
      id: "qualified",
      category: "Opportunities advanced",
      label: "Opportunities qualified",
      detail: `${qualified} ${pluralize(qualified, "opportunity", "opportunities")} qualified`,
    })
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const campaignsPrepared = Math.max(activeCampaigns, pendingDrafts)
  if (campaignsPrepared > 0) {
    items.push({
      id: "campaigns",
      category: "Campaigns prepared",
      label: "Campaigns prepared",
      detail: `${campaignsPrepared} personalized ${pluralize(campaignsPrepared, "campaign", "campaigns")}`,
    })
  }

  const meetingsBooked = Math.max(
    briefing?.meetings.meetings_this_week ?? 0,
    briefing?.summary.meetings_today ?? 0,
    metricValue(dashboard, "activity", "Meetings today"),
  )
  if (meetingsBooked > 0) {
    items.push({
      id: "meetings",
      category: "Meetings booked",
      label: "Meetings booked",
      detail: `${meetingsBooked} ${pluralize(meetingsBooked, "meeting", "meetings")} on the calendar`,
    })
  }

  const advanced = Math.min(closeCandidates, metricValue(dashboard, "pipeline-snapshot", "Open opportunities"))
  if (advanced > 0) {
    items.push({
      id: "pipeline",
      category: "Opportunities advanced",
      label: "Opportunities advanced",
      detail: `${advanced} ${pluralize(advanced, "opportunity", "opportunities")} moved forward`,
    })
  }

  const revenue = briefing?.revenue.revenue ?? 0
  if (revenue > 0) {
    items.push({
      id: "revenue",
      category: "Revenue influenced",
      label: "Revenue influenced",
      detail: `1 deal closed worth ${formatHomeCurrency(revenue)}`,
    })
  }

  return items.slice(0, 6)
}

function buildNeedsReview(
  dashboard: GrowthWorkspaceDashboardViewModel,
  approvalSummary: GrowthHomeApprovalSummary | null,
  exceptions: GrowthHomeAttentionItem[],
): GrowthHomeNeedsReview {
  const groups = approvalSummary?.groups ?? []
  const totalCount = approvalSummary?.totalPending ?? 0
  const reviewHref =
    approvalSummary?.reviewHref ??
    (metricValue(dashboard, "campaign-snapshot", "Approval queue") > 0
      ? metricHref(dashboard, "campaign-snapshot", "Approval queue")
      : metricHref(dashboard, "my-queue", "Leads needing action"))

  return {
    totalCount,
    groups,
    reviewHref,
    attentionItems: exceptions.slice(0, 5),
  }
}

function buildCheckIn(
  dashboard: GrowthWorkspaceDashboardViewModel,
  teammate: AiTeammatePresentation,
  executiveBrief: GrowthHomeExecutiveBrief,
  employeeStatus: GrowthHomeAiEmployeeStatus,
  approvalTotal: number,
  continuityInput: GrowthHomeContinuityInput,
  activeMissionCount: number,
  activeMarketingMissionCount: number,
  marketingVoiceLines: string[],
  activeCustomerSuccessMissionCount: number,
  customerSuccessVoiceLines: string[],
  totalServiceMissionCount: number,
  serviceVoiceLines: string[],
): GrowthHomeCheckIn {
  const foundObservations = buildOwnershipFoundObservations(dashboard)
  const calmLine = proactiveCalmLine(approvalTotal)
  const continuity = buildContinuityOpening(continuityInput)
  const missionSummary = operatorMissionSummary(activeMissionCount)
  const mktSummary = marketingOperatorSummary(activeMarketingMissionCount)
  const csSummary = customerSuccessOperatorSummary(activeCustomerSuccessMissionCount)
  const svcSummary = serviceOperatorSummary(totalServiceMissionCount)

  return {
    greeting: executiveBrief.greeting,
    hasContinuity: continuity.hasContinuity,
    continuityIntro: continuity.continuityIntro,
    continuityBullets: continuity.continuityBullets,
    operatorMissionSummary: missionSummary,
    activeMissionCount,
    marketingOperatorSummary: mktSummary,
    activeMarketingMissionCount,
    marketingVoiceLines,
    customerSuccessOperatorSummary: csSummary,
    activeCustomerSuccessMissionCount,
    customerSuccessVoiceLines,
    serviceOperatorSummary: svcSummary,
    totalServiceMissionCount,
    serviceVoiceLines,
    foundIntro: AI_PROACTIVE_FOUND_INTRO,
    foundObservations: continuity.hasContinuity ? continuity.continuityBullets : foundObservations,
    calmLine,
    awayIntro: continuity.hasContinuity && continuity.continuityIntro ? continuity.continuityIntro : AI_PROACTIVE_FOUND_INTRO,
    completedWhileAway: continuity.hasContinuity ? continuity.continuityBullets : foundObservations,
    focusIntro: AI_EMPLOYEE_CHECK_IN_FOCUS_INTRO,
    focusingOn: buildFocusItems(dashboard),
    needsReviewLine: employeeNeedsHelpLine(approvalTotal),
    teammateName: teammate.name,
    teammateRole: teammate.role,
    primaryCta: executiveBrief.primaryCta,
    secondaryCta: executiveBrief.secondaryCta,
    status: employeeStatus,
  }
}

function buildWorkSummary(
  completedToday: GrowthHomeCompletedTodayItem[],
  activityGroups: GrowthHomeActivityGroup[],
): GrowthHomeWorkSummaryCategory[] {
  const categoryItems = new Map<string, string[]>()

  for (const item of completedToday) {
    const key =
      item.id === "research"
        ? "prospecting"
        : item.id === "campaigns"
          ? "campaigns"
          : item.id === "meetings"
            ? "meetings"
            : item.id === "revenue"
              ? "revenue"
              : item.id === "qualified" || item.id === "pipeline"
                ? "prospecting"
                : "monitoring"
    const list = categoryItems.get(key) ?? []
    list.push(item.detail)
    categoryItems.set(key, list)
  }

  const learningGroup = activityGroups.find((g) => g.id === "learning")
  if (learningGroup) {
    const list = categoryItems.get("learning") ?? []
    list.push(learningGroup.summary.replace(/^Ava is /i, "").replace(/^She is /i, ""))
    categoryItems.set("learning", list)
  }

  const monitoringGroup = activityGroups.find((g) => g.id === "monitoring-risk")
  if (monitoringGroup) {
    const list = categoryItems.get("monitoring") ?? []
    list.push(monitoringGroup.summary.replace(/^Ava is /i, "").replace(/^She is /i, ""))
    categoryItems.set("monitoring", list)
  }

  return AI_EMPLOYEE_WORK_SUMMARY_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    items: categoryItems.get(category.id) ?? [],
  })).filter((category) => category.items.length > 0)
}

function buildTimeline(
  dashboard: GrowthWorkspaceDashboardViewModel,
  recentViews: GrowthWorkspaceRecentView[],
  _teammate: AiTeammatePresentation,
): GrowthHomeTimelinePeriod[] {
  const briefing = dashboard.briefing
  const yesterday: string[] = []
  const today: string[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  if (hot > 0) {
    yesterday.push(
      translateHomeTimelineFirstPerson(
        `Identified ${hot} high-value ${pluralize(hot, "account", "accounts")}`,
      ),
    )
  }

  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  if (emailsSent > 0) {
    yesterday.push(
      translateHomeTimelineFirstPerson(
        `Prepared ${emailsSent} personalized ${pluralize(emailsSent, "email", "emails")}`,
      ),
    )
  }

  const positiveReplies = briefing?.inbox.positive_interest ?? 0
  if (positiveReplies > 0) {
    yesterday.push(`I heard back from ${positiveReplies} interested ${pluralize(positiveReplies, "prospect", "prospects")}.`)
  }

  const qualified = metricValue(dashboard, "my-queue", "Call-ready leads") + metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  if (qualified > 0) {
    yesterday.push(`I qualified ${qualified} new ${pluralize(qualified, "opportunity", "opportunities")}.`)
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  if (pendingApprovals > 0) {
    today.push(`I'm waiting for your approval before sending (${pendingApprovals} ${pluralize(pendingApprovals, "item", "items")}).`)
  }

  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  if (repliesNeedingAttention > 0) {
    today.push(`I'm monitoring ${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "reply", "replies")} that need your response.`)
  }

  if (briefing?.section_summaries.approval_queue) {
    today.push(translateHomeTimelineFirstPerson("Approval queue updated", briefing.section_summaries.approval_queue))
  }

  for (const view of recentViews.slice(0, 2)) {
    yesterday.push(translateHomeTimelineFirstPerson(`Reviewed ${view.title}`, view.subtitle))
  }

  if (yesterday.length === 0) {
    yesterday.push("I continued monitoring accounts and inbox activity.")
  }
  if (today.length === 0) {
    today.push("I'm keeping your queue in good shape — nothing urgent right now.")
  }

  return [
    { id: "yesterday", periodLabel: "Since your last visit", items: yesterday.slice(0, 5) },
    { id: "today", periodLabel: "Today", items: today.slice(0, 5) },
  ]
}

function buildApprovalSummary(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeApprovalSummary | null {
  const briefing = dashboard.briefing
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const pendingJobs = briefing?.approval_queue.pending_jobs ?? 0
  const sequencePending = metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const total = Math.max(pendingDrafts + pendingJobs, sequencePending)

  if (total <= 0) return null

  const blocked = briefing?.summary.blocked_jobs ?? 0
  const waitingOnApproval = Math.max(total - pendingDrafts - pendingJobs - blocked, 0)
  const groups = [
    ...(pendingDrafts > 0
      ? [{ id: "ready-to-send", label: AI_EMPLOYEE_REVIEW_BUCKETS.readyToSend, count: pendingDrafts }]
      : []),
    ...(pendingJobs > 0
      ? [{ id: "ready-to-activate", label: AI_EMPLOYEE_REVIEW_BUCKETS.readyToActivate, count: pendingJobs }]
      : []),
    ...(waitingOnApproval > 0
      ? [{ id: "needs-decision", label: AI_EMPLOYEE_REVIEW_BUCKETS.needsYourDecision, count: waitingOnApproval }]
      : []),
    ...(total > 0 && pendingDrafts + pendingJobs === 0 && waitingOnApproval === 0
      ? [{ id: "waiting-on-approval", label: AI_EMPLOYEE_REVIEW_BUCKETS.waitingOnApproval, count: total }]
      : []),
    ...(blocked > 0 ? [{ id: "blocked", label: AI_EMPLOYEE_REVIEW_BUCKETS.blocked, count: blocked }] : []),
  ].filter((row) => row.count > 0)

  return {
    totalPending: total,
    groups: groups.length > 0 ? groups : [{ id: "all", label: AI_EMPLOYEE_REVIEW_BUCKETS.waitingOnApproval, count: total }],
    reviewHref: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns/sequences`,
  }
}

function outcomeMetricLabel(raw: string): string {
  const map: Record<string, string> = {
    "Leads needing action": "Accounts AI prioritized",
    "Call-ready leads": "Meetings AI prepared",
    "Inbox requiring replies": "Replies waiting on you",
    "Opportunities needing follow-up": "Deals AI advanced",
    "Emails sent today": "Outreach AI completed",
    "Replies today": "Prospect replies received",
    "Calls today": "Calls AI logged",
    "Meetings today": "Meetings AI booked",
    "Open opportunities": "Active opportunities",
    "Forecast value": "Pipeline AI influenced",
    "Weighted pipeline": "Weighted pipeline",
    "Close candidates": "Deals near close",
    "Active campaigns": "Campaigns AI prepared",
    "Enrollments": "Prospects enrolled",
    "Executions today": "Actions AI completed today",
    "Approval queue": "Items waiting on you",
    "Engagement score": "Engagement momentum",
    "Hot companies": "High-intent accounts found",
    "Relationship alerts": "Relationships needing touch",
    "Conversation alerts": "Conversations at risk",
  }
  return map[raw] ?? raw
}

function buildBusinessSnapshot(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeBusinessMetric[] {
  const metrics: GrowthHomeBusinessMetric[] = []

  for (const section of dashboard.sections) {
    if (section.id === "quick-actions") continue
    for (const metric of section.metrics) {
      if (metric.value <= 0 && section.id !== "pipeline-snapshot") continue
      const isCurrency =
        metric.label.includes("value") ||
        metric.label.includes("pipeline") ||
        metric.label.includes("Forecast")
      metrics.push({
        id: `${section.id}-${metric.label}`,
        label: outcomeMetricLabel(metric.label),
        value: isCurrency ? formatHomeCurrency(metric.value) : String(metric.value),
        href: metric.href,
      })
    }
  }

  const priorityLabels = new Set([
    "Open opportunities",
    "Weighted pipeline",
    "Replies today",
    "Leads needing action",
    "Active campaigns",
    "Meetings today",
  ])

  const prioritized = [
    ...metrics.filter((m) => priorityLabels.has(m.label)),
    ...metrics.filter((m) => !priorityLabels.has(m.label)),
  ]

  const seen = new Set<string>()
  return prioritized.filter((m) => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  }).slice(0, BUSINESS_SNAPSHOT_LIMIT)
}

export function synthesizeGrowthHomeExecutiveBriefing(
  input: GrowthHomeExecutiveBriefingInput,
): GrowthHomeExecutiveBriefingViewModel {
  const { dashboard, recentViews = [], continueItems = [], revenueDirectorSnapshot } = input
  const teammate = input.teammate ?? defaultTeammatePresentation()
  const { primary, additional } = buildRecommendations(dashboard)

  const revenueMissionInput: GrowthHomeRevenueMissionInput = {
    dashboard,
    revenueDirectorSnapshot,
  }
  const marketingMissionInput: GrowthHomeMarketingMissionInput = {
    dashboard,
    revenueDirectorSnapshot,
  }
  const activeRevenueMissions = buildActiveRevenueMissions(revenueMissionInput)
  const marketingMissions = buildMarketingMissions(marketingMissionInput)
  const campaignPerformance = buildCampaignPerformance(marketingMissionInput, marketingMissions)
  const contentPreparing = buildContentPreparing(marketingMissionInput)
  const audienceIntelligence = buildAudienceIntelligence(marketingMissionInput)
  const marketingContribution = buildMarketingContribution(marketingMissionInput)
  const marketingVoiceLines = buildMarketingOperatorVoice(marketingMissionInput, marketingMissions)
  const csMissionInput: GrowthHomeCustomerSuccessMissionInput = {
    dashboard,
    revenueDirectorSnapshot,
  }
  const customerSuccessMissions = buildCustomerSuccessMissions(csMissionInput)
  const customerHealth = buildCustomerHealth(csMissionInput, customerSuccessMissions)
  const expansionOpportunities = buildExpansionOpportunities(csMissionInput)
  const renewalsMonitoring = buildRenewalsMonitoring(csMissionInput)
  const customerWins = buildCustomerWins(csMissionInput)
  const csContribution = buildCsContribution(csMissionInput)
  const customerSuccessVoiceLines = buildCustomerSuccessOperatorVoice(
    csMissionInput,
    customerSuccessMissions,
    renewalsMonitoring,
    expansionOpportunities,
  )
  const serviceMissionInput: GrowthHomeServiceMissionInput = {
    dashboard,
    revenueDirectorSnapshot,
  }
  const serviceMissions = buildServiceMissions(serviceMissionInput)
  const totalServiceMissionCount = countTotalServiceMissions(dashboard)
  const serviceHealth = buildServiceHealth(serviceMissionInput)
  const technicianAwareness = buildTechnicianAwareness(serviceMissionInput)
  const serviceFollowUps = buildServiceFollowUps(serviceMissionInput)
  const operationalInsights = buildOperationalInsights(serviceMissionInput)
  const serviceContribution = buildServiceContribution(serviceMissionInput)
  const serviceVoiceLines = buildServiceOperatorVoice(
    serviceMissionInput,
    serviceMissions,
    serviceHealth,
    serviceFollowUps,
  )
  const missionHealth = buildMissionHealthSummaries(activeRevenueMissions)
  const missionTimeline = buildMissionTimeline(revenueMissionInput, activeRevenueMissions)
  const nextPlannedActions = buildNextPlannedActions(revenueMissionInput, activeRevenueMissions)
  const revenueForecast = buildRevenueForecast(revenueMissionInput, activeRevenueMissions)

  const exceptions = buildExceptions(dashboard)
  const executiveBrief = buildExecutiveBrief(dashboard, teammate, exceptions.length)
  const approvalSummary = buildApprovalSummary(dashboard)
  const aiActivity = buildAiActivity(dashboard, teammate)
  const employeeStatus = deriveEmployeeStatus(dashboard)
  const completedToday = buildCompletedToday(dashboard)
  const workingOnNow = buildWorkingOnNow(dashboard, aiActivity)
  const needsReview = buildNeedsReview(dashboard, approvalSummary, exceptions)
  const timeline = buildTimeline(dashboard, recentViews, teammate)
  const initiativeRecommendations = buildInitiativeRecommendations(dashboard)
  const accomplishments = buildAccomplishmentGroups(dashboard)

  const continuityInput: GrowthHomeContinuityInput = {
    dashboard,
    recentViews,
    continueItems,
    timeline,
    accomplishments,
    initiativeRecommendations,
  }

  const checkIn = buildCheckIn(
    dashboard,
    teammate,
    executiveBrief,
    employeeStatus,
    needsReview.totalCount,
    continuityInput,
    activeRevenueMissions.length,
    marketingMissions.length,
    marketingVoiceLines,
    customerSuccessMissions.length,
    customerSuccessVoiceLines,
    totalServiceMissionCount,
    serviceVoiceLines,
  )
  const workSummary = buildWorkSummary(completedToday, aiActivity)
  const thingsNoticed = buildOwnershipThingsNoticed(dashboard)
  const watching = buildWatchingItems(dashboard)
  const businessAwareness = buildBusinessAwareness(dashboard, executiveBrief)
  const myPriorities = buildMyPriorities(dashboard)
  const weeklyGoals = buildWeeklyGoals(dashboard)
  const waitingOnYouResult = buildWaitingOnYou(dashboard, needsReview, approvalSummary)
  const biggestWin = buildBiggestWin(dashboard, executiveBrief)
  const biggestRiskFeatured = buildBiggestRiskFeatured(dashboard, executiveBrief)
  const aiWorkload = buildAiWorkload(dashboard)
  const executiveRecommendation = buildExecutiveRecommendation(
    dashboard,
    initiativeRecommendations,
    waitingOnYouResult.items,
  )
  const aiOsUx = buildAiOsUxViewModel({
    dashboard,
    executiveBrief,
    waitingOnYou: waitingOnYouResult.items,
    waitingOnYouOverflow: waitingOnYouResult.overflowCount,
    needsReview,
  })
  const sinceWeLastMet = buildSinceWeLastMet(continuityInput)
  const whatChanged = buildWhatChanged(continuityInput)
  const recommendationContinuity = buildRecommendationContinuity(continuityInput)
  const ourProgress = buildOurProgress(dashboard)
  const milestones = buildMilestones(dashboard)
  const trustExplanations = buildTrustExplanations(dashboard)
  const dailyBriefing = buildDailyBriefing(continuityInput)

  return {
    readOnly: true,
    qaMarker: GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER,
    generatedAt: dashboard.generatedAt,
    executiveBrief,
    exceptions,
    needsAttention: exceptions,
    recommendation: primary,
    additionalRecommendations: additional,
    aiActivity,
    timeline,
    approvalSummary,
    businessSnapshot: buildBusinessSnapshot(dashboard),
    checkIn,
    employeeStatus,
    completedToday,
    workingOnNow,
    needsReview,
    workSummary,
    thingsNoticed,
    watching,
    initiativeRecommendations,
    businessAwareness,
    myPriorities,
    accomplishments,
    weeklyGoals,
    waitingOnYou: waitingOnYouResult.items,
    waitingOnYouOverflow: waitingOnYouResult.overflowCount,
    biggestWin,
    biggestRiskFeatured,
    aiWorkload,
    executiveRecommendation,
    sinceWeLastMet,
    whatChanged,
    recommendationContinuity,
    ourProgress,
    milestones,
    trustExplanations,
    dailyBriefing,
    activeRevenueMissions,
    missionHealth,
    missionTimeline,
    nextPlannedActions,
    revenueForecast,
    marketingMissions,
    campaignPerformance,
    contentPreparing,
    audienceIntelligence,
    marketingContribution,
    customerSuccessMissions,
    customerHealth,
    expansionOpportunities,
    renewalsMonitoring,
    customerWins,
    csContribution,
    serviceMissions,
    serviceHealth,
    technicianAwareness,
    serviceFollowUps,
    operationalInsights,
    serviceContribution,
    aiOsUx,
  }
}

export function buildGrowthHomeExecutiveBriefingCertDashboard(): GrowthWorkspaceDashboardViewModel {
  return {
    qaMarker: "growth-workspace-dashboard-v4",
    generatedAt: new Date("2026-06-25T09:30:00.000Z").toISOString(),
    sections: [
      {
        id: "my-queue" as const,
        title: "My Queue",
        metrics: [
          { label: "Leads needing action", value: 12, href: "/growth/leads" },
          { label: "Call-ready leads", value: 4, href: "/growth/calls" },
          { label: "Inbox requiring replies", value: 2, href: "/growth/inbox" },
          { label: "Opportunities needing follow-up", value: 3, href: "/growth/opportunities/pipeline" },
        ],
      },
      {
        id: "activity" as const,
        title: "Activity",
        metrics: [
          { label: "Emails sent today", value: 5, href: "/growth/campaigns" },
          { label: "Replies today", value: 2, href: "/growth/inbox" },
          { label: "Calls today", value: 1, href: "/growth/calls" },
          { label: "Meetings today", value: 1, href: "/growth/meetings" },
        ],
      },
      {
        id: "pipeline-snapshot" as const,
        title: "Pipeline Snapshot",
        metrics: [
          { label: "Open opportunities", value: 8, href: "/growth/opportunities/pipeline" },
          { label: "Forecast value", value: 186000, href: "/growth/opportunities/pipeline" },
          { label: "Weighted pipeline", value: 186000, href: "/growth/opportunities/pipeline" },
          { label: "Close candidates", value: 2, href: "/growth/opportunities" },
        ],
      },
      {
        id: "campaign-snapshot" as const,
        title: "Campaign Snapshot",
        metrics: [
          { label: "Active campaigns", value: 4, href: "/growth/campaigns/sequences" },
          { label: "Enrollments", value: 20, href: "/growth/campaigns" },
          { label: "Executions today", value: 5, href: "/growth/campaigns/sequences" },
          { label: "Approval queue", value: 11, href: "/growth/campaigns/sequences" },
        ],
      },
      {
        id: "intelligence" as const,
        title: "Intelligence",
        metrics: [
          { label: "Engagement score", value: 72, href: "/growth/engagement" },
          { label: "Hot companies", value: 3, href: "/growth/engagement" },
          { label: "Relationship alerts", value: 1, href: "/growth/relationships" },
          { label: "Conversation alerts", value: 0, href: "/growth/conversations" },
        ],
      },
      { id: "quick-actions" as const, title: "Quick Actions", metrics: [] },
    ],
    quickActions: [],
    operatorActionCards: [
      {
        id: "approve-sends",
        title: "Approve pending sends",
        description: "11 sequence steps waiting for human approval.",
        href: "/growth/campaigns/sequences",
      },
    ],
    welcome: {
      greeting: "Good morning",
      operatorName: "Michael",
      recommendedAction: "Approve the Precision Biomedical campaign.",
      todaysFocus: "Clear approvals and respond to hot replies.",
    },
    briefing: {
      qa_marker: AIDEN_DAILY_BRIEFING_QA_MARKER,
      greeting: "Good morning",
      operator_name: "Michael",
      generated_at: new Date("2026-06-25T09:00:00.000Z").toISOString(),
      summary: {
        mailbox_label: "Warning",
        pending_approvals: 11,
        replies_needing_attention: 2,
        meetings_today: 1,
        blocked_jobs: 0,
        drafts_awaiting_review: 8,
        recommended_action: "Approve the Precision Biomedical campaign.",
      },
      inbox: {
        new_replies: 2,
        replies_needing_attention: 2,
        positive_interest: 1,
        meeting_requests: 1,
        objections: 0,
        unsubscribes: 0,
      },
      mailbox: { healthy_mailboxes: 2, expired_mailboxes: 0, warnings: 1 },
      approval_queue: { pending_drafts: 8, pending_jobs: 2, blocked_jobs: 0, running_jobs: 1 },
      meetings: { meetings_today: 1, meetings_this_week: 2, opportunities_pending: 3 },
      revenue: { emails_sent: 5, replies: 2, meetings: 1, opportunities: 3, revenue: 186000 },
      priorities: [
        {
          priority: 1,
          title: "Approve the Precision Biomedical campaign",
          detail: "High-fit accounts are ready for personalized outreach.",
          href: "/growth/campaigns/sequences",
        },
      ],
      section_summaries: {
        inbox: "Two replies need your attention, including one meeting request.",
        mailbox: "One mailbox warning — validate connection before sending.",
        approval_queue: "Eight outreach drafts and two communication plans await approval.",
        meetings: "One meeting today and another scheduled this week.",
        revenue: "Pipeline momentum is strong with new replies coming in.",
      },
    },
    operatorName: "Michael",
    recommendedAction: "Approve the Precision Biomedical campaign.",
    leadInboxHighlights: [],
    dailyRevenueWorkQueueEnabled: true,
    dailyRevenueWorkQueue: {
      version: 1,
      qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
      generatedAt: new Date("2026-06-25T09:00:00.000Z").toISOString(),
      totalAccounts: 2,
      estimatedWorkloadMinutes: 45,
      suggestedDailyCapacity: 35,
      channelAllocation: { email: 1 },
      critical: [
        {
          leadId: "lead-precision-biomedical",
          companyId: "lead-precision-biomedical",
          priority: "critical",
          action: "send_email",
          communicationStrategy: {
            primaryChannel: "email",
            recommendedAction: "send_email",
            confidence: 88,
            requiresHumanApproval: true,
          },
          recommendedChannel: "email",
          estimatedMinutes: 10,
          confidence: 88,
          requiresHumanApproval: true,
          dueAt: null,
          reasoning: ["Precision Biomedical is sequence-ready and awaiting approval."],
          sortScore: 100,
          taskKey: "lead-precision-biomedical:send_email",
        },
      ],
      high: [],
      medium: [],
      low: [],
      waiting: [],
      blocked: [],
      completed: [],
    },
    dailyRevenueWorkQueueDisplay: {
      qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
      generated_at: new Date("2026-06-25T09:00:00.000Z").toISOString(),
      total_accounts: 2,
      actionable_count: 1,
      waiting_count: 0,
      blocked_count: 0,
      estimated_workload_minutes: 45,
      suggested_daily_capacity: 35,
      channel_summary: "1 Email",
      bucket_counts: { critical: 1, high: 0, medium: 0, waiting: 0, blocked: 0 },
      top_items: [
        {
          lead_id: "lead-precision-biomedical",
          company_id: "lead-precision-biomedical",
          company_name: "Precision Biomedical",
          priority: "critical",
          action_label: "Send email",
          channel_label: "Email",
          confidence: 88,
          reasoning: "Precision Biomedical is sequence-ready and awaiting approval.",
          estimated_minutes: 10,
          requires_human_approval: true,
        },
      ],
    },
  }
}

export function buildGrowthHomeExecutiveBriefingCertFixture(): GrowthHomeExecutiveBriefingViewModel {
  return synthesizeGrowthHomeExecutiveBriefing({
    dashboard: buildGrowthHomeExecutiveBriefingCertDashboard(),
    recentViews: [
      {
        id: "campaign:sequences",
        type: "lead",
        title: "Campaign sequences",
        subtitle: "Precision Biomedical",
        href: "/growth/campaigns/sequences",
        viewedAt: "2026-06-24T16:00:00.000Z",
      },
      {
        id: "opportunity:pipeline",
        type: "opportunity",
        title: "Pipeline",
        href: "/growth/opportunities/pipeline",
        viewedAt: "2026-06-24T14:00:00.000Z",
      },
    ],
    continueItems: [
      {
        id: "continue-campaign",
        type: "campaign",
        title: "Resume campaign",
        subtitle: "Continue sequence work",
        href: "/growth/campaigns/sequences",
        lastOpenedAt: "2026-06-24T17:00:00.000Z",
      },
    ],
  })
}
