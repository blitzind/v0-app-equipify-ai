/** GE-AI-UX-6A — Ownership & accountability synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthHomeExecutiveBrief } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeAiWorkloadItem,
  GrowthHomeApprovalSummary,
  GrowthHomeAttentionItem,
  GrowthHomeExecutiveRecommendation,
  GrowthHomeFeaturedOutcome,
  GrowthHomeInitiativeRecommendation,
  GrowthHomeMyPriority,
  GrowthHomeNeedsReview,
  GrowthHomeWaitingOnYouItem,
  GrowthHomeWeeklyGoal,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  hasCanonicalDailyWorkQueue,
  pickTopCanonicalQueueActionItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-canonical-queue-mapper"
import {
  AI_OWNERSHIP_ACCOMPLISHMENT_GROUPS,
  AI_OWNERSHIP_WAITING_ON_YOU_LIMIT,
  ownershipPhrase,
  progressBarLabel,
  progressPercent,
} from "@/lib/workspace/ai-ownership-accountability"
import {
  deriveInitiativeConfidence,
  initiativeConfidenceLabel,
} from "@/lib/workspace/ai-proactive-initiative"

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

export function buildMyPriorities(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeMyPriority[] {
  const briefing = dashboard.briefing
  const priorities: GrowthHomeMyPriority[] = []

  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const qualified = callReady + leads
  if (qualified > 0) {
    const target = Math.max(qualified, hot + leads)
    const progress = progressPercent(qualified, target)
    priorities.push({
      id: "outreach-prep",
      title: ownershipPhrase("preparing", `outreach for ${qualified} qualified ${pluralize(qualified, "prospect", "prospects")}`).replace(/\.$/, ""),
      whyItMatters: "These accounts are ready for personalized outreach that moves pipeline forward.",
      progressPercent: progress,
      progressLabel: progressBarLabel(progress),
      nextStep: "Finalize drafts and queue sends after your approval.",
      waitingOnMe: ["Personalizing messaging for each account"],
      waitingOnYou: (briefing?.summary.pending_approvals ?? 0) > 0 ? ["Approval from you before sending"] : [],
      href: metricHref(dashboard, "my-queue", "Call-ready leads"),
    })
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const pendingApprovals = briefing?.summary.pending_approvals ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  if (activeCampaigns + pendingDrafts > 0) {
    const total = activeCampaigns + pendingDrafts
    const progress = progressPercent(activeCampaigns, total)
    priorities.push({
      id: "campaign-wave",
      title: ownershipPhrase("preparing", `${total} personalized ${pluralize(total, "campaign", "campaigns")}`).replace(/\.$/, ""),
      whyItMatters: "Prepared campaigns unlock the next wave of outbound once approved.",
      progressPercent: progress,
      progressLabel: progressBarLabel(progress),
      nextStep: pendingApprovals > 0 ? "Send immediately after approval." : "Activate the next campaign wave.",
      waitingOnMe: ["Monitoring deliverability and enrollment health"],
      waitingOnYou: pendingApprovals > 0 ? [`Approval on ${pendingApprovals} ${pluralize(pendingApprovals, "item", "items")}`] : [],
      href: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
    })
  }

  const replies = metricValue(dashboard, "my-queue", "Inbox requiring replies")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  if (replies + repliesNeedingAttention > 0) {
    const total = replies + repliesNeedingAttention
    const progress = progressPercent(repliesNeedingAttention, total)
    priorities.push({
      id: "inbox-follow-up",
      title: ownershipPhrase("monitoring", `${total} active ${pluralize(total, "conversation", "conversations")}`).replace(/\.$/, ""),
      whyItMatters: "Timely follow-up protects deal momentum and meeting requests.",
      progressPercent: Math.max(progress, 30),
      progressLabel: progressBarLabel(Math.max(progress, 30)),
      nextStep: "Respond to warm replies and confirm next steps.",
      waitingOnMe: ["Drafting follow-up responses"],
      waitingOnYou: repliesNeedingAttention > 0 ? ["Your response on priority replies"] : [],
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  if (closeCandidates > 0) {
    const progress = progressPercent(closeCandidates, Math.max(closeCandidates, 5))
    priorities.push({
      id: "pipeline-advance",
      title: ownershipPhrase("tracking", `${closeCandidates} ${pluralize(closeCandidates, "opportunity", "opportunities")} near close`).replace(/\.$/, ""),
      whyItMatters: "Advancing late-stage deals has the highest revenue impact this week.",
      progressPercent: progress,
      progressLabel: progressBarLabel(progress),
      nextStep: "Confirm proposal timing and stakeholder alignment.",
      waitingOnMe: ["Preparing meeting briefs and next-step plans"],
      waitingOnYou: [],
      href: metricHref(dashboard, "pipeline-snapshot", "Close candidates"),
    })
  }

  if (priorities.length === 0) {
    priorities.push({
      id: "monitor-market",
      title: ownershipPhrase("monitoring", "your market and inbox for the next priority").replace(/\.$/, ""),
      whyItMatters: "Continuous monitoring keeps you ahead of new opportunities.",
      progressPercent: 40,
      progressLabel: progressBarLabel(40),
      nextStep: "Surface the next high-fit account to pursue.",
      waitingOnMe: ["Scanning engagement and inbox signals"],
      waitingOnYou: [],
      href: metricHref(dashboard, "my-queue", "Leads needing action"),
    })
  }

  return priorities.slice(0, 5)
}

export function buildAccomplishmentGroups(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAccomplishmentGroup[] {
  const briefing = dashboard.briefing
  const groups = new Map<string, string[]>()

  const revenue = briefing?.revenue.revenue ?? 0
  if (revenue > 0) {
    const list = groups.get("revenue") ?? []
    list.push(`I influenced ${formatHomeCurrency(revenue)} in closed revenue today.`)
    groups.set("revenue", list)
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const qualified = callReady + closeCandidates
  if (qualified > 0) {
    const list = groups.get("pipeline") ?? []
    const valueHint = weightedPipeline > 0 ? ` worth approximately ${formatHomeCurrency(weightedPipeline)}` : ""
    list.push(`I qualified ${qualified} ${pluralize(qualified, "opportunity", "opportunities")}${valueHint}.`)
    groups.set("pipeline", list)
  }

  const meetingsBooked = Math.max(
    briefing?.meetings.meetings_this_week ?? 0,
    briefing?.summary.meetings_today ?? 0,
    metricValue(dashboard, "activity", "Meetings today"),
  )
  if (meetingsBooked > 0) {
    const list = groups.get("meetings") ?? []
    list.push(`I booked ${meetingsBooked} ${pluralize(meetingsBooked, "meeting", "meetings")}.`)
    groups.set("meetings", list)
  }

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const researched = hot + leads + (briefing?.revenue.opportunities ?? 0)
  if (researched > 0) {
    const list = groups.get("prospecting") ?? []
    list.push(`I researched ${researched} ${pluralize(researched, "company", "companies")} and prioritized fit.`)
    groups.set("prospecting", list)
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const campaignsPrepared = Math.max(activeCampaigns, pendingDrafts)
  if (campaignsPrepared > 0 || emailsSent > 0) {
    const list = groups.get("campaigns") ?? []
    if (campaignsPrepared > 0) {
      list.push(`I prepared outreach for ${campaignsPrepared} ${pluralize(campaignsPrepared, "decision maker", "decision makers")}.`)
    }
    if (emailsSent > 0) {
      list.push(`I completed ${emailsSent} outreach ${pluralize(emailsSent, "action", "actions")} today.`)
    }
    groups.set("campaigns", list)
  }

  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const positiveReplies = briefing?.inbox.positive_interest ?? 0
  if (relationshipAlerts + positiveReplies > 0) {
    const list = groups.get("relationships") ?? []
    list.push(`I advanced ${relationshipAlerts + positiveReplies} active ${pluralize(relationshipAlerts + positiveReplies, "relationship", "relationships")}.`)
    groups.set("relationships", list)
  }

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  if (engagementScore > 0) {
    const list = groups.get("learning") ?? []
    list.push(`I reviewed recent outcomes — engagement momentum is at ${engagementScore}.`)
    groups.set("learning", list)
  }

  return AI_OWNERSHIP_ACCOMPLISHMENT_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: groups.get(group.id) ?? [],
  })).filter((group) => group.items.length > 0)
}

export function buildWeeklyGoals(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeWeeklyGoal[] {
  const briefing = dashboard.briefing
  const goals: GrowthHomeWeeklyGoal[] = []

  const meetingsThisWeek = briefing?.meetings.meetings_this_week ?? 0
  const meetingsTarget = Math.max(8, meetingsThisWeek || 1)
  goals.push({
    id: "meetings",
    label: "Book 8 meetings",
    targetLabel: `${meetingsTarget} meetings`,
    currentValue: meetingsThisWeek,
    targetValue: meetingsTarget,
    progressPercent: progressPercent(meetingsThisWeek, meetingsTarget),
  })

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const pipelineTarget = Math.max(500_000, weightedPipeline || 1)
  goals.push({
    id: "pipeline",
    label: "Generate $500k pipeline",
    targetLabel: formatHomeCurrency(pipelineTarget),
    currentValue: weightedPipeline,
    targetValue: pipelineTarget,
    progressPercent: progressPercent(weightedPipeline, pipelineTarget),
  })

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const qualifiedCurrent = hot + leads + (briefing?.revenue.opportunities ?? 0)
  const qualifyTarget = Math.max(120, qualifiedCurrent || 1)
  goals.push({
    id: "prospects",
    label: "Qualify 120 prospects",
    targetLabel: `${qualifyTarget} prospects`,
    currentValue: qualifiedCurrent,
    targetValue: qualifyTarget,
    progressPercent: progressPercent(qualifiedCurrent, qualifyTarget),
  })

  const campaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const campaignsCurrent = campaigns + pendingDrafts
  const campaignTarget = Math.max(60, campaignsCurrent || 1)
  goals.push({
    id: "campaigns",
    label: "Prepare 60 campaigns",
    targetLabel: `${campaignTarget} campaigns`,
    currentValue: campaignsCurrent,
    targetValue: campaignTarget,
    progressPercent: progressPercent(campaignsCurrent, campaignTarget),
  })

  for (const priority of briefing?.priorities?.slice(0, 1) ?? []) {
    goals.unshift({
      id: `objective-${priority.priority}`,
      label: sanitizeHomeNarrative(priority.title),
      targetLabel: "Current objective",
      currentValue: priority.priority === 1 ? 70 : 40,
      targetValue: 100,
      progressPercent: priority.priority === 1 ? 70 : 40,
    })
  }

  return goals.slice(0, 5)
}

export function buildWaitingOnYou(
  dashboard: GrowthWorkspaceDashboardViewModel,
  needsReview: GrowthHomeNeedsReview,
  _approvalSummary: GrowthHomeApprovalSummary | null,
): { items: GrowthHomeWaitingOnYouItem[]; overflowCount: number } {
  const items: GrowthHomeWaitingOnYouItem[] = []

  for (const group of needsReview.groups) {
    items.push({
      id: `waiting-${group.id}`,
      label: `${group.label} (${group.count})`,
      detail: `${group.count} ${pluralize(group.count, "item", "items")} need your decision.`,
      href: needsReview.reviewHref,
    })
  }

  for (const card of dashboard.operatorActionCards) {
    items.push({
      id: `waiting-card-${card.id}`,
      label: sanitizeHomeNarrative(card.title),
      detail: sanitizeHomeNarrative(card.description),
      href: card.href,
    })
  }

  for (const item of needsReview.attentionItems) {
    items.push({
      id: `waiting-attention-${item.id}`,
      label: item.headline,
      detail: item.summary,
      href: item.ctaHref,
    })
  }

  for (const priority of dashboard.briefing?.priorities?.slice(0, 2) ?? []) {
    if (/approve|review|choose|decision/i.test(priority.title)) {
      items.push({
        id: `waiting-priority-${priority.priority}`,
        label: sanitizeHomeNarrative(priority.title),
        detail: sanitizeHomeNarrative(priority.detail),
        href: priority.href,
      })
    }
  }

  const deduped = new Map<string, GrowthHomeWaitingOnYouItem>()
  for (const item of items) {
    if (!deduped.has(item.id)) deduped.set(item.id, item)
  }

  const all = [...deduped.values()]

  return {
    items: all.slice(0, AI_OWNERSHIP_WAITING_ON_YOU_LIMIT),
    overflowCount: Math.max(0, all.length - AI_OWNERSHIP_WAITING_ON_YOU_LIMIT),
  }
}

export function buildBiggestWin(
  dashboard: GrowthWorkspaceDashboardViewModel,
  executiveBrief: GrowthHomeExecutiveBrief,
): GrowthHomeFeaturedOutcome | null {
  const briefing = dashboard.briefing
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const revenue = briefing?.revenue.revenue ?? 0

  if (executiveBrief.biggestWin) {
    const confidence = deriveInitiativeConfidence({ impactScore: 85, hasMetricEvidence: true })
    return {
      headline: `Today ${executiveBrief.biggestWin.headline.toLowerCase().startsWith("i ") ? executiveBrief.biggestWin.headline : `I identified ${executiveBrief.biggestWin.headline.toLowerCase()}`}.`,
      whyItMatters: executiveBrief.biggestWin.detail,
      suggestedNextStep: executiveBrief.suggestedNextAction.label,
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [executiveBrief.biggestWin.detail, sanitizeHomeNarrative(briefing?.section_summaries.revenue ?? "Revenue read model.")],
      href: executiveBrief.suggestedNextAction.href,
    }
  }

  if (weightedPipeline > 0 && hot > 0) {
    const confidence = deriveInitiativeConfidence({ impactScore: 80, hasMetricEvidence: true })
    return {
      headline: `Today I identified a high-intent expansion opportunity worth approximately ${formatHomeCurrency(weightedPipeline)}.`,
      whyItMatters: `${hot} high-intent ${pluralize(hot, "account", "accounts")} show strong buying signals in your pipeline.`,
      suggestedNextStep: "Review the highest-fit account and approve the next outreach wave.",
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [
        `${hot} hot ${pluralize(hot, "company", "companies")} in intelligence.`,
        `${formatHomeCurrency(weightedPipeline)} weighted pipeline.`,
      ],
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    }
  }

  if (revenue > 0) {
    const confidence = deriveInitiativeConfidence({ impactScore: 90, hasMetricEvidence: true })
    return {
      headline: `Today I closed influence on a deal worth approximately ${formatHomeCurrency(revenue)}.`,
      whyItMatters: sanitizeHomeNarrative(briefing?.section_summaries.revenue ?? "Revenue momentum is building."),
      suggestedNextStep: "Advance the next close candidate while momentum is high.",
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [`Closed revenue signal: ${formatHomeCurrency(revenue)}.`],
      href: metricHref(dashboard, "pipeline-snapshot", "Close candidates"),
    }
  }

  return null
}

export function buildBiggestRiskFeatured(
  dashboard: GrowthWorkspaceDashboardViewModel,
  executiveBrief: GrowthHomeExecutiveBrief,
): GrowthHomeFeaturedOutcome | null {
  const briefing = dashboard.briefing
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const followUp = metricValue(dashboard, "my-queue", "Opportunities needing follow-up")
  const stale = conversationAlerts + relationshipAlerts + followUp

  if (executiveBrief.biggestRisk) {
    const confidence = deriveInitiativeConfidence({ impactScore: 75, hasMetricEvidence: true })
    return {
      headline: ownershipPhrase("protecting", `pipeline from ${executiveBrief.biggestRisk.headline.toLowerCase()}`),
      whyItMatters: executiveBrief.biggestRisk.detail,
      suggestedNextStep: "Address this before it stalls momentum.",
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [executiveBrief.biggestRisk.detail],
      href: metricHref(dashboard, "my-queue", "Opportunities needing follow-up"),
    }
  }

  if (stale > 0) {
    const confidence = deriveInitiativeConfidence({ impactScore: 70, hasMetricEvidence: true })
    return {
      headline: ownershipPhrase("tracking", `${stale} high-fit ${pluralize(stale, "prospect", "prospects")} that need contact`),
      whyItMatters: "Delayed follow-up reduces reply rates and meeting conversion.",
      suggestedNextStep: "Prioritize outreach on the oldest untouched accounts.",
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [
        `${conversationAlerts} conversation alerts.`,
        `${relationshipAlerts} relationship alerts.`,
        `${followUp} opportunities needing follow-up.`,
      ],
      href: metricHref(dashboard, "my-queue", "Opportunities needing follow-up"),
    }
  }

  if ((briefing?.mailbox.expired_mailboxes ?? 0) > 0 || (briefing?.mailbox.warnings ?? 0) > 0) {
    return {
      headline: ownershipPhrase("protecting", "sender health before the next outreach wave"),
      whyItMatters: sanitizeHomeNarrative(briefing?.section_summaries.mailbox ?? "Mailbox warnings can block sends."),
      suggestedNextStep: "Validate mailbox connection before approving campaigns.",
      confidenceLabel: initiativeConfidenceLabel("high"),
      evidence: [sanitizeHomeNarrative(briefing?.section_summaries.mailbox ?? "Mailbox read model.")],
      href: `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications/mailboxes`,
    }
  }

  return null
}

export function buildAiWorkload(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAiWorkloadItem[] {
  const briefing = dashboard.briefing
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const campaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? 0
  const replies = metricValue(dashboard, "my-queue", "Inbox requiring replies")
  const executions = metricValue(dashboard, "campaign-snapshot", "Executions today")
  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")

  const researchTarget = Math.max(leads + hot, 1)
  const outreachTarget = Math.max(campaigns + pendingDrafts + executions, 1)
  const monitoringTarget = Math.max(replies + (briefing?.summary.replies_needing_attention ?? 0) + hot, 1)
  const learningTarget = 100

  return [
    {
      id: "research",
      label: "Research",
      progressPercent: progressPercent(leads + hot, researchTarget),
    },
    {
      id: "outreach",
      label: "Outreach",
      progressPercent: progressPercent(campaigns + pendingDrafts + executions, outreachTarget),
    },
    {
      id: "monitoring",
      label: "Monitoring",
      progressPercent: progressPercent(replies + hot, monitoringTarget),
    },
    {
      id: "learning",
      label: "Learning",
      progressPercent: progressPercent(engagementScore, learningTarget),
    },
  ]
}

export function buildExecutiveRecommendation(
  dashboard: GrowthWorkspaceDashboardViewModel,
  initiativeRecommendations: GrowthHomeInitiativeRecommendation[],
  waitingOnYou: GrowthHomeWaitingOnYouItem[],
): GrowthHomeExecutiveRecommendation | null {
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
      const blocked = dashboard.dailyRevenueWorkQueueDisplay.blocked_count
      const waiting = dashboard.dailyRevenueWorkQueueDisplay.waiting_count
      return {
        headline: "Here's my recommendation.",
        sentence: top.requiresHumanApproval
          ? `I recommend approving ${top.actionLabel.toLowerCase()} for ${top.companyName} before I continue.`
          : `Based on today's revenue queue, I recommend ${top.actionLabel.toLowerCase()} for ${top.companyName} via ${top.channelLabel}.`,
        evidence: [
          top.reasoning,
          blocked > 0 ? `${blocked} blocked ${pluralize(blocked, "item", "items")} need review.` : "",
          waiting > 0 ? `${waiting} ${pluralize(waiting, "item", "items")} waiting on you.` : "",
        ].filter(Boolean),
        href: top.href,
      }
    }
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const pendingApprovals = dashboard.briefing?.summary.pending_approvals ?? 0
  const primary = initiativeRecommendations[0]

  if (pendingApprovals > 0 && waitingOnYou.length > 0) {
    const pipelineEstimate = weightedPipeline > 0
      ? formatHomeCurrency(Math.round(weightedPipeline * 0.35))
      : "additional qualified pipeline"
    const replyCount = dashboard.briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
    const meetingEstimate = Math.max(
      0,
      Math.round((dashboard.briefing?.meetings.meetings_this_week ?? 0) + replyCount * 0.4),
    )
    const conversationEstimate = Math.max(replyCount, Math.round(pendingApprovals * 0.5))
    const confidence = deriveInitiativeConfidence({
      impactScore: weightedPipeline > 0 ? 88 : 72,
      hasMetricEvidence: weightedPipeline > 0,
      priorityRank: 1,
    })
    return {
      headline: "Here's my recommendation.",
      sentence: `Based on today's activity, I recommend approving the ${pendingApprovals} prepared outreach ${pluralize(pendingApprovals, "item", "items")}.`,
      evidence: waitingOnYou.slice(0, 3).map((item) => item.detail),
      expectedResults: [
        conversationEstimate > 0
          ? `${conversationEstimate} additional ${pluralize(conversationEstimate, "conversation", "conversations")}`
          : null,
        meetingEstimate > 0
          ? `${meetingEstimate} ${pluralize(meetingEstimate, "meeting", "meetings")}`
          : null,
        weightedPipeline > 0 ? `approximately ${pipelineEstimate} influenced pipeline` : null,
      ].filter((row): row is string => Boolean(row)),
      href: waitingOnYou[0]?.href ?? null,
      confidencePercent: confidence === "high" ? 92 : confidence === "medium" ? 82 : 71,
      confidenceLabel: initiativeConfidenceLabel(confidence),
    }
  }

  if (primary) {
    return {
      headline: "Here's my recommendation.",
      sentence: primary.headline.endsWith(".") ? primary.headline : `${primary.headline}.`,
      evidence: primary.evidence,
      href: primary.primaryCtaHref,
    }
  }

  if (weightedPipeline > 0) {
    return {
      headline: "Here's my recommendation.",
      sentence: `I'm responsible for advancing ${formatHomeCurrency(weightedPipeline)} in pipeline — review my top priority to keep momentum this week.`,
      evidence: [sanitizeHomeNarrative(dashboard.briefing?.section_summaries.revenue ?? "Pipeline read model.")],
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    }
  }

  return null
}

export function buildOwnershipFoundObservations(dashboard: GrowthWorkspaceDashboardViewModel): string[] {
  const briefing = dashboard.briefing
  const observations: string[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  if (hot + leads > 0) {
    observations.push(
      ownershipPhrase("responsible", `monitoring ${hot + leads} ${pluralize(hot + leads, "account", "accounts")} that match your ICP`),
    )
  }

  const inactive =
    metricValue(dashboard, "intelligence", "Conversation alerts") +
    metricValue(dashboard, "intelligence", "Relationship alerts") +
    metricValue(dashboard, "my-queue", "Opportunities needing follow-up")
  if (inactive > 0) {
    observations.push(
      ownershipPhrase("tracking", `${inactive} ${pluralize(inactive, "opportunity", "opportunities")} at risk of going inactive`),
    )
  }

  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  if (emailsSent > 0 && replies > 0) {
    const rate = Math.round((replies / emailsSent) * 100)
    observations.push(ownershipPhrase("optimizing", `outreach where response rates reached ${rate}%`))
  }

  if (hot > 0) {
    observations.push(ownershipPhrase("monitoring", `${hot} ${pluralize(hot, "prospect", "prospects")} with active buying signals`))
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  if (activeCampaigns > 0) {
    observations.push(ownershipPhrase("preparing", `${activeCampaigns} active ${pluralize(activeCampaigns, "campaign", "campaigns")}`))
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? 0
  if (pendingApprovals > 0) {
    observations.push(ownershipPhrase("waiting", `your approval on ${pendingApprovals} prepared ${pluralize(pendingApprovals, "item", "items")}`))
  } else {
    observations.push("Nothing urgent requires your attention today.")
  }

  return observations.slice(0, 6)
}

export function buildOwnershipThingsNoticed(dashboard: GrowthWorkspaceDashboardViewModel): import("@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types").GrowthHomeNoticedItem[] {
  const briefing = dashboard.briefing
  const items: import("@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types").GrowthHomeNoticedItem[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  if (hot > 0) {
    items.push({
      id: "icp-match",
      category: "opportunities",
      observation: ownershipPhrase("responsible", `${hot} high-intent ${pluralize(hot, "account", "accounts")} in your ICP`),
      evidence: `${hot} hot ${pluralize(hot, "company", "companies")} in intelligence signals.`,
      href: metricHref(dashboard, "intelligence", "Hot companies"),
    })
  }

  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  if (conversationAlerts + relationshipAlerts > 0) {
    const total = conversationAlerts + relationshipAlerts
    items.push({
      id: "inactive-risk",
      category: "risks",
      observation: ownershipPhrase("tracking", `${total} cooling ${pluralize(total, "relationship", "relationships")}`),
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? `${total} relationship and conversation alerts.`),
      href: metricHref(dashboard, "intelligence", "Relationship alerts"),
    })
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? 0
  if (pendingApprovals > 0) {
    items.push({
      id: "approval-backlog",
      category: "campaigns",
      observation: ownershipPhrase("waiting", `your approval on ${pendingApprovals} prepared ${pluralize(pendingApprovals, "item", "items")}`),
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? `${pendingApprovals} items in the approval queue.`),
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  if (weightedPipeline > 0) {
    items.push({
      id: "pipeline-momentum",
      category: "revenue",
      observation: ownershipPhrase("responsible", `${formatHomeCurrency(weightedPipeline)} in pipeline momentum`),
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.revenue ?? "Pipeline snapshot from open opportunities."),
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    })
  }

  return items.slice(0, 6)
}
