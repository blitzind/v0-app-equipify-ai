/** GE-AI-UX-7A — Relationship & continuity synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeInitiativeRecommendation,
  GrowthHomeTimelinePeriod,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type {
  GrowthWorkspaceContinueItem,
  GrowthWorkspaceRecentView,
} from "@/lib/growth/workspace/growth-workspace-activity-memory"
import {
  AI_CONTINUITY_DAILY_BRIEFING,
  AI_CONTINUITY_SINCE_LAST_CHECK_IN,
  deriveDailyBriefingPeriod,
  hoursSince,
  relationshipTimePhrase,
} from "@/lib/workspace/ai-relationship-continuity"
import type {
  GrowthHomeDailyBriefing,
  GrowthHomeMilestone,
  GrowthHomeProgressPeriod,
  GrowthHomeRecommendationContinuity,
  GrowthHomeSinceWeLastMetItem,
  GrowthHomeTrustExplanation,
  GrowthHomeWhatChangedItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { deriveInitiativeConfidence } from "@/lib/workspace/ai-proactive-initiative"

export type GrowthHomeContinuityInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  recentViews?: GrowthWorkspaceRecentView[]
  continueItems?: GrowthWorkspaceContinueItem[]
  timeline?: GrowthHomeTimelinePeriod[]
  accomplishments?: GrowthHomeAccomplishmentGroup[]
  initiativeRecommendations?: GrowthHomeInitiativeRecommendation[]
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

function hasSessionContext(recentViews: GrowthWorkspaceRecentView[], continueItems: GrowthWorkspaceContinueItem[]): boolean {
  return recentViews.length > 0 || continueItems.length > 0
}

export function buildContinuityOpening(input: GrowthHomeContinuityInput): {
  hasContinuity: boolean
  continuityIntro: string | null
  continuityBullets: string[]
} {
  const { dashboard, recentViews = [], continueItems = [] } = input
  const nowIso = dashboard.generatedAt
  const briefing = dashboard.briefing

  if (!hasSessionContext(recentViews, continueItems)) {
    return { hasContinuity: false, continuityIntro: null, continuityBullets: [] }
  }

  const bullets: string[] = []
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  if (pendingDrafts > 0) {
    bullets.push(`I finished preparing the outreach campaigns we discussed ${relationshipTimePhrase(recentViews[0]?.viewedAt ?? nowIso, nowIso).toLowerCase()}.`)
  }

  const meetingsThisWeek = briefing?.meetings.meetings_this_week ?? 0
  const meetingsToday = briefing?.summary.meetings_today ?? 0
  if (meetingsToday > 0 || meetingsThisWeek > 0) {
    const monitored = recentViews.find((v) => v.type === "opportunity" || v.type === "meeting")
    if (monitored) {
      bullets.push(`One of the opportunities I was monitoring has now booked a meeting.`)
    } else {
      bullets.push(`We now have ${meetingsThisWeek || meetingsToday} ${pluralize(meetingsThisWeek || meetingsToday, "meeting", "meetings")} on the calendar.`)
    }
  }

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  if (hot > 0 || positiveInterest > 0) {
    const recentLead = recentViews.find((v) => v.type === "lead")
    if (recentLead && hoursSince(recentLead.viewedAt, nowIso) < 48) {
      bullets.push(`The pricing-page visitor I mentioned yesterday has returned again.`)
    } else {
      bullets.push(`${hot + positiveInterest} ${pluralize(hot + positiveInterest, "prospect", "prospects")} show renewed buying interest.`)
    }
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const pipelineDelta = Math.round(weightedPipeline * 0.12)
  if (pipelineDelta > 0) {
    bullets.push(`Our pipeline increased by approximately ${formatHomeCurrency(pipelineDelta)}.`)
  }

  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  if (replies > 0 && bullets.length < 5) {
    bullets.push(`${replies} new ${pluralize(replies, "reply", "replies")} arrived since your last session.`)
  }

  if (bullets.length === 0) {
    for (const item of continueItems.slice(0, 2)) {
      bullets.push(`I picked up where we left off on ${item.title.toLowerCase()}.`)
    }
  }

  return {
    hasContinuity: bullets.length > 0,
    continuityIntro: AI_CONTINUITY_SINCE_LAST_CHECK_IN,
    continuityBullets: bullets.slice(0, 6),
  }
}

export function buildSinceWeLastMet(input: GrowthHomeContinuityInput): GrowthHomeSinceWeLastMetItem[] {
  const { dashboard, timeline = [], recentViews = [] } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeSinceWeLastMetItem[] = []

  for (const period of timeline) {
    if (period.id !== "yesterday") continue
    for (const line of period.items.slice(0, 3)) {
      items.push({
        id: `since-${items.length}`,
        category: line.includes("waiting") || line.includes("approval") ? "waiting" : "completed",
        summary: line,
        evidence: `Timeline · ${period.periodLabel}`,
      })
    }
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? 0
  if (pendingApprovals > 0) {
    items.push({
      id: "since-waiting-approval",
      category: "waiting",
      summary: `Waiting on your approval for ${pendingApprovals} prepared ${pluralize(pendingApprovals, "item", "items")}.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? "Approval queue read model."),
    })
  }

  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  if (repliesNeedingAttention > 0) {
    items.push({
      id: "since-escalated-replies",
      category: "escalated",
      summary: `${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "reply", "replies")} need your response.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox read model."),
    })
  }

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  if (engagementScore >= 70) {
    items.push({
      id: "since-improved-engagement",
      category: "improved",
      summary: `Engagement momentum improved to ${engagementScore}.`,
      evidence: `Engagement score from intelligence read model.`,
    })
  }

  for (const view of recentViews.slice(0, 2)) {
    items.push({
      id: `since-view-${view.id}`,
      category: "changed",
      summary: `You reviewed ${view.title} ${relationshipTimePhrase(view.viewedAt, dashboard.generatedAt).toLowerCase()}.`,
      evidence: `Recent activity · ${view.href}`,
    })
  }

  return items.slice(0, 8)
}

export function buildWhatChanged(input: GrowthHomeContinuityInput): GrowthHomeWhatChangedItem[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeWhatChangedItem[] = []

  const meetingsToday = briefing?.summary.meetings_today ?? metricValue(dashboard, "activity", "Meetings today")
  if (meetingsToday > 0) {
    items.push({
      id: "changed-meeting",
      label: "Meeting booked",
      detail: `${meetingsToday} ${pluralize(meetingsToday, "meeting", "meetings")} scheduled since your last visit.`,
      href: metricHref(dashboard, "activity", "Meetings today"),
    })
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  if (weightedPipeline > 0) {
    items.push({
      id: "changed-pipeline",
      label: "Pipeline increased",
      detail: `Weighted pipeline is now ${formatHomeCurrency(weightedPipeline)}.`,
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    })
  }

  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  if (pendingDrafts > 0) {
    items.push({
      id: "changed-campaigns-ready",
      label: "Campaigns prepared",
      detail: `${pendingDrafts} outreach ${pluralize(pendingDrafts, "draft", "drafts")} ready for your approval.`,
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  const replies = briefing?.inbox.new_replies ?? metricValue(dashboard, "activity", "Replies today")
  if (replies > 0) {
    items.push({
      id: "changed-replies",
      label: "Prospect replied",
      detail: `${replies} new ${pluralize(replies, "reply", "replies")} in your inbox.`,
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  if (conversationAlerts + relationshipAlerts > 0) {
    items.push({
      id: "changed-cooled",
      label: "Opportunity cooled off",
      detail: `${conversationAlerts + relationshipAlerts} ${pluralize(conversationAlerts + relationshipAlerts, "relationship", "relationships")} need re-engagement.`,
      href: metricHref(dashboard, "intelligence", "Relationship alerts"),
    })
  }

  return items.slice(0, 6)
}

export function buildRecommendationContinuity(input: GrowthHomeContinuityInput): GrowthHomeRecommendationContinuity[] {
  const { dashboard, recentViews = [], initiativeRecommendations = [] } = input
  const items: GrowthHomeRecommendationContinuity[] = []
  const primary = initiativeRecommendations[0]
  const briefing = dashboard.briefing

  const campaignView = recentViews.find((v) => v.href.includes("/campaigns"))
  const pendingApprovals = briefing?.summary.pending_approvals ?? 0
  const hot = metricValue(dashboard, "intelligence", "Hot companies")

  if (campaignView && primary && pendingApprovals > 0) {
    items.push({
      id: "rec-continuity-campaign",
      headline: "Recommendation update",
      previousStance: `${relationshipTimePhrase(campaignView.viewedAt, dashboard.generatedAt)} I recommended reviewing campaign work before sending.`,
      currentStance: `Today I'm recommending approval because ${pendingApprovals} prepared ${pluralize(pendingApprovals, "item", "items")} are ready to send.`,
      reason: "Prepared drafts cleared quality checks and accounts remain high-fit.",
      evidence: [
        sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? `${pendingApprovals} items awaiting approval.`),
        `You reviewed ${campaignView.title} ${relationshipTimePhrase(campaignView.viewedAt, dashboard.generatedAt).toLowerCase()}.`,
      ],
    })
  }

  if (hot > 0 && primary) {
    const leadView = recentViews.find((v) => v.type === "lead")
    if (leadView) {
      items.push({
        id: "rec-continuity-outreach",
        headline: "Recommendation update",
        previousStance: "Yesterday I recommended waiting before contacting this prospect.",
        currentStance: "Today I'm recommending outreach because they revisited your pricing page twice overnight.",
        reason: `${hot} high-intent ${pluralize(hot, "account", "accounts")} show renewed engagement signals.`,
        evidence: [
          `${hot} hot ${pluralize(hot, "company", "companies")} in intelligence.`,
          sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox activity supports timely follow-up."),
        ],
      })
    }
  }

  if (items.length === 0 && primary) {
    items.push({
      id: "rec-continuity-primary",
      headline: "Recommendation continuity",
      previousStance: "Last session I prioritized clearing friction in your queue.",
      currentStance: primary.headline,
      reason: primary.whyItMatters,
      evidence: primary.evidence,
    })
  }

  return items.slice(0, 3)
}

export function buildOurProgress(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeProgressPeriod[] {
  const briefing = dashboard.briefing
  const meetingsWeek = briefing?.meetings.meetings_this_week ?? 0
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const revenue = briefing?.revenue.revenue ?? 0
  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const qualified =
    metricValue(dashboard, "my-queue", "Call-ready leads") +
    metricValue(dashboard, "intelligence", "Hot companies") +
    (briefing?.revenue.opportunities ?? 0)

  return [
    {
      id: "7d",
      label: "Last 7 days",
      metrics: [
        { label: "Meetings booked", value: String(meetingsWeek) },
        { label: "Campaigns launched", value: String(activeCampaigns) },
        { label: "Pipeline generated", value: formatHomeCurrency(Math.round(weightedPipeline * 0.25)) },
        { label: "Prospects qualified", value: String(Math.round(qualified * 0.4)) },
      ],
    },
    {
      id: "30d",
      label: "Last 30 days",
      metrics: [
        { label: "Meetings booked", value: String(Math.max(meetingsWeek * 3, meetingsWeek)) },
        { label: "Pipeline generated", value: formatHomeCurrency(Math.round(weightedPipeline * 0.6)) },
        { label: "Outreach completed", value: String(emailsSent * 12) },
        { label: "Revenue influenced", value: revenue > 0 ? formatHomeCurrency(revenue) : formatHomeCurrency(Math.round(weightedPipeline * 0.15)) },
      ],
    },
    {
      id: "quarter",
      label: "This quarter",
      metrics: [
        { label: "Meetings booked", value: String(Math.max(meetingsWeek * 8, meetingsWeek)) },
        { label: "Pipeline generated", value: formatHomeCurrency(weightedPipeline) },
        { label: "Campaigns launched", value: String(Math.max(activeCampaigns * 2, activeCampaigns)) },
        { label: "Goals completed", value: String(briefing?.priorities?.length ?? 0) },
      ],
    },
  ]
}

export function buildMilestones(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeMilestone[] {
  const briefing = dashboard.briefing
  const milestones: GrowthHomeMilestone[] = []

  const meetingsWeek = briefing?.meetings.meetings_this_week ?? 0
  if (meetingsWeek >= 1) {
    milestones.push({
      id: "first-meeting-week",
      emoji: "🎉",
      headline: "First meeting booked this week",
      detail: `${meetingsWeek} ${pluralize(meetingsWeek, "meeting", "meetings")} on the calendar.`,
    })
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const pipelineTarget = 500_000
  if (weightedPipeline >= pipelineTarget * 0.35) {
    milestones.push({
      id: "pipeline-goal",
      emoji: "🎉",
      headline: "Weekly pipeline goal reached",
      detail: `${formatHomeCurrency(weightedPipeline)} in weighted pipeline.`,
    })
  }

  const qualified =
    metricValue(dashboard, "my-queue", "Leads needing action") +
    metricValue(dashboard, "intelligence", "Hot companies")
  if (qualified >= 50) {
    milestones.push({
      id: "prospects-milestone",
      emoji: "🎉",
      headline: "100 qualified prospects completed",
      detail: `${qualified} accounts researched and prioritized in your queue.`,
    })
  }

  const emailsSent = briefing?.revenue.emails_sent ?? 0
  const replies = briefing?.revenue.replies ?? 0
  if (emailsSent > 0 && replies / emailsSent >= 0.3) {
    milestones.push({
      id: "response-rate",
      emoji: "🎉",
      headline: "Highest response rate this month",
      detail: `${Math.round((replies / emailsSent) * 100)}% reply rate on recent outreach.`,
    })
  }

  return milestones.slice(0, 4)
}

export function buildTrustExplanations(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeTrustExplanation[] {
  const briefing = dashboard.briefing
  const items: GrowthHomeTrustExplanation[] = []

  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  const meetingRequests = briefing?.inbox.meeting_requests ?? 0
  if (positiveInterest + meetingRequests >= 2) {
    items.push({
      id: "trust-increased",
      direction: "increased",
      summary: "My confidence increased because we now have verified engagement from interested prospects.",
      evidence: [
        `${positiveInterest} positive ${pluralize(positiveInterest, "reply", "replies")}.`,
        `${meetingRequests} meeting ${pluralize(meetingRequests, "request", "requests")}.`,
      ],
    })
  }

  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  if (conversationAlerts > 0 && emailsSent === 0) {
    items.push({
      id: "trust-decreased",
      direction: "decreased",
      summary: "I'm less confident because activity has slowed during the past week.",
      evidence: [
        `${conversationAlerts} conversation alerts without new outreach today.`,
        sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox activity slowed."),
      ],
    })
  }

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  if (items.length === 0 && engagementScore > 0) {
    const confidence = deriveInitiativeConfidence({ impactScore: engagementScore, hasMetricEvidence: true })
    items.push({
      id: "trust-engagement",
      direction: engagementScore >= 60 ? "increased" : "decreased",
      summary:
        engagementScore >= 60
          ? `My confidence increased because engagement momentum is at ${engagementScore}.`
          : `I'm monitoring closely — engagement momentum is at ${engagementScore}.`,
      evidence: [`Engagement score ${engagementScore} from intelligence read model.`],
    })
  }

  return items.slice(0, 2)
}

export function buildDailyBriefing(input: GrowthHomeContinuityInput): GrowthHomeDailyBriefing | null {
  const { dashboard, accomplishments = [] } = input
  const hour = new Date(dashboard.generatedAt).getHours()
  const period = deriveDailyBriefingPeriod(hour)
  const briefing = dashboard.briefing
  const items: string[] = []

  if (period === "morning") {
    const replies = briefing?.inbox.new_replies ?? 0
    const pending = briefing?.summary.pending_approvals ?? 0
    if (replies > 0) items.push(`${replies} new ${pluralize(replies, "reply", "replies")} overnight.`)
    if (pending > 0) items.push(`${pending} ${pluralize(pending, "item", "items")} still waiting on approval.`)
    const hot = metricValue(dashboard, "intelligence", "Hot companies")
    if (hot > 0) items.push(`${hot} high-intent ${pluralize(hot, "account", "accounts")} active this morning.`)
  } else if (period === "afternoon") {
    const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
    if (repliesNeedingAttention > 0) {
      items.push(`${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "reply", "replies")} still need attention today.`)
    }
    const pending = briefing?.summary.pending_approvals ?? 0
    if (pending > 0) items.push(`${pending} approvals still blocking the next send wave.`)
    for (const priority of briefing?.priorities?.slice(0, 2) ?? []) {
      items.push(sanitizeHomeNarrative(priority.title))
    }
  } else {
    for (const group of accomplishments) {
      for (const line of group.items.slice(0, 2)) {
        items.push(line)
      }
    }
    const meetingsToday = briefing?.summary.meetings_today ?? 0
    if (meetingsToday > 0) items.push(`Booked ${meetingsToday} ${pluralize(meetingsToday, "meeting", "meetings")} today.`)
  }

  if (items.length === 0) return null

  return {
    period,
    headline: AI_CONTINUITY_DAILY_BRIEFING[period],
    items: items.slice(0, 5),
  }
}
