/** GE-AI-UX-5A — Proactive initiative synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthHomeExecutiveBrief } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type {
  GrowthHomeBusinessAwareness,
  GrowthHomeInitiativeRecommendation,
  GrowthHomeNoticedItem,
  GrowthHomeWatchingItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import {
  AI_PROACTIVE_FOUND_INTRO,
  deriveInitiativeConfidence,
  deriveInitiativePriority,
  initiativeConfidenceLabel,
  initiativeObservationPrefix,
  initiativePriorityLabel,
  proactiveCalmLine,
  recommendBecause,
  type AiInitiativeRecommendationCategory,
} from "@/lib/workspace/ai-proactive-initiative"

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

export function buildFoundObservations(dashboard: GrowthWorkspaceDashboardViewModel): string[] {
  const briefing = dashboard.briefing
  const observations: string[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action")
  const icpMatches = hot > 0 ? hot : leads > 0 ? Math.min(leads, 5) : 0
  if (icpMatches > 0) {
    observations.push(
      `${icpMatches} ${pluralize(icpMatches, "company", "companies")} match your current ICP.`,
    )
  }

  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const followUpNeeded = metricValue(dashboard, "my-queue", "Opportunities needing follow-up")
  const inactive = conversationAlerts + relationshipAlerts + followUpNeeded
  if (inactive > 0) {
    observations.push(
      `${inactive} ${pluralize(inactive, "opportunity", "opportunities")} ${inactive === 1 ? "is" : "are"} becoming inactive.`,
    )
  }

  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  if (emailsSent > 0 && replies > 0) {
    const rate = Math.round((replies / emailsSent) * 100)
    if (rate > 0) {
      observations.push(`Response rates increased to ${rate}% on recent outreach.`)
    }
  }

  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  if (hot > 0 || positiveInterest > 0) {
    const signalCount = Math.max(hot, positiveInterest)
    observations.push(
      `${signalCount} ${pluralize(signalCount, "prospect", "prospects")} ${signalCount === 1 ? "shows" : "show"} strong buying signals.`,
    )
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const executions = metricValue(dashboard, "campaign-snapshot", "Executions today")
  if (activeCampaigns > 0 && executions > 0) {
    observations.push(
      `${activeCampaigns} ${pluralize(activeCampaigns, "campaign", "campaigns")} ${activeCampaigns === 1 ? "is" : "are"} outperforming expectations.`,
    )
  }

  const meetingsThisWeek = briefing?.meetings.meetings_this_week ?? 0
  if (meetingsThisWeek > 0 && observations.length < 6) {
    observations.push(
      `${meetingsThisWeek} ${pluralize(meetingsThisWeek, "meeting", "meetings")} scheduled this week.`,
    )
  }

  if (observations.length === 0) {
    observations.push("Your pipeline and inbox are stable — I'm continuing to monitor for new signals.")
  }

  return observations.slice(0, 6)
}

export function buildThingsNoticed(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeNoticedItem[] {
  const briefing = dashboard.briefing
  const items: GrowthHomeNoticedItem[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  if (hot > 0) {
    items.push({
      id: "icp-match",
      category: "opportunities",
      observation: `${initiativeObservationPrefix("found")} ${hot} high-intent ${pluralize(hot, "account", "accounts")} that match your ICP.`,
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
      observation: `${initiativeObservationPrefix("noticed")} ${total} ${pluralize(total, "relationship", "relationships")} cooling off.`,
      evidence: sanitizeHomeNarrative(
        briefing?.section_summaries.inbox ?? `${conversationAlerts} conversation alerts and ${relationshipAlerts} relationship alerts.`,
      ),
      href: metricHref(dashboard, "intelligence", "Relationship alerts"),
    })
  }

  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  if (repliesNeedingAttention > 0 || positiveInterest > 0) {
    items.push({
      id: "warm-replies",
      category: "follow_up",
      observation: `${initiativeObservationPrefix("detected")} ${repliesNeedingAttention + positiveInterest} warm ${pluralize(repliesNeedingAttention + positiveInterest, "reply", "replies")} worth a follow-up.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox signals show active prospect interest."),
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  if (pendingApprovals > 0) {
    items.push({
      id: "approval-backlog",
      category: "campaigns",
      observation: `${initiativeObservationPrefix("identified")} ${pendingApprovals} prepared ${pluralize(pendingApprovals, "item", "items")} waiting on your approval.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.approval_queue ?? `${pendingApprovals} items in the approval queue.`),
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  if (weightedPipeline > 0) {
    items.push({
      id: "pipeline-momentum",
      category: "revenue",
      observation: `${initiativeObservationPrefix("discovered")} ${formatHomeCurrency(weightedPipeline)} in weighted pipeline momentum.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.revenue ?? "Pipeline snapshot from your open opportunities."),
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    })
  }

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  if (engagementScore > 0 && items.length < 6) {
    items.push({
      id: "engagement-trend",
      category: "learning",
      observation: `${initiativeObservationPrefix("noticed")} engagement momentum at ${engagementScore} — recent outreach is landing.`,
      evidence: `Engagement score ${engagementScore} from intelligence read model.`,
      href: metricHref(dashboard, "intelligence", "Engagement score"),
    })
  }

  return items.slice(0, 6)
}

export function buildWatchingItems(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeWatchingItem[] {
  const briefing = dashboard.briefing
  const items: GrowthHomeWatchingItem[] = []

  const replies = metricValue(dashboard, "my-queue", "Inbox requiring replies")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  if (replies + repliesNeedingAttention > 0) {
    items.push({
      id: "inbox",
      label: "Watching inbox activity",
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  if (activeCampaigns > 0) {
    items.push({
      id: "campaigns",
      label: "Monitoring campaign performance",
      href: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
    })
  }

  const pendingApprovals = briefing?.summary.pending_approvals ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  if (pendingApprovals > 0) {
    items.push({
      id: "approvals",
      label: "Tracking proposal approvals",
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  if (hot > 0) {
    items.push({
      id: "buying-signals",
      label: "Looking for buying signals",
      href: metricHref(dashboard, "intelligence", "Hot companies"),
    })
  }

  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  if (positiveInterest > 0) {
    items.push({
      id: "warm-prospects",
      label: "Monitoring warm prospects",
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  for (const card of dashboard.operatorActionCards.slice(0, 2)) {
    const title = card.title.trim()
    if (/reply|follow.?up|respond/i.test(title) || /reply|follow.?up|respond/i.test(card.description)) {
      items.push({
        id: `watch-${card.id}`,
        label: `Waiting for a reply — ${sanitizeHomeNarrative(title).replace(/\.$/, "")}`,
        href: card.href,
      })
    }
  }

  if (items.length === 0) {
    items.push({
      id: "market",
      label: "Monitoring your market and inbox",
      href: metricHref(dashboard, "my-queue", "Leads needing action"),
    })
  }

  return items.slice(0, 6)
}

function categorizeRecommendation(title: string, detail: string): AiInitiativeRecommendationCategory {
  const combined = `${title} ${detail}`.toLowerCase()
  if (/meeting|calendar|call/.test(combined)) return "meetings"
  if (/campaign|outreach|send|sequence|draft/.test(combined)) return "campaigns"
  if (/pipeline|revenue|deal|close|forecast/.test(combined)) return "revenue"
  if (/risk|block|expired|warning|mailbox/.test(combined)) return "risks"
  if (/reply|follow|inbox|respond/.test(combined)) return "follow_up"
  if (/learn|engagement|score/.test(combined)) return "learning"
  return "opportunities"
}

export function buildInitiativeRecommendations(
  dashboard: GrowthWorkspaceDashboardViewModel,
): GrowthHomeInitiativeRecommendation[] {
  const briefing = dashboard.briefing
  const recommendations: GrowthHomeInitiativeRecommendation[] = []

  for (const priority of briefing?.priorities ?? []) {
    const detail = sanitizeHomeNarrative(priority.detail)
    const impactScore = 100 - priority.priority * 15
    const confidence = deriveInitiativeConfidence({ impactScore, hasMetricEvidence: true, priorityRank: priority.priority })
    const priorityLevel = deriveInitiativePriority({ impactScore, priorityRank: priority.priority, urgent: priority.priority === 1 })
    recommendations.push({
      id: `initiative-priority-${priority.priority}`,
      category: categorizeRecommendation(priority.title, detail),
      headline: recommendBecause(priority.title.replace(/\.$/, ""), detail),
      whyItMatters: detail,
      recommendedAction: priority.title,
      confidence,
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [detail, `Priority rank ${priority.priority} from daily briefing.`],
      priority: priorityLevel,
      priorityLabel: initiativePriorityLabel(priorityLevel),
      primaryCtaLabel: "Take action",
      primaryCtaHref: priority.href,
    })
  }

  for (const card of dashboard.operatorActionCards.slice(0, 3)) {
    const detail = sanitizeHomeNarrative(card.description)
    const impactScore = card.id.includes("approve") ? 90 : 70
    const confidence = deriveInitiativeConfidence({ impactScore, hasMetricEvidence: true })
    const priorityLevel = deriveInitiativePriority({ impactScore, urgent: card.id.includes("approve") })
    recommendations.push({
      id: `initiative-card-${card.id}`,
      category: categorizeRecommendation(card.title, detail),
      headline: recommendBecause(card.title.replace(/\.$/, ""), detail),
      whyItMatters: detail,
      recommendedAction: card.title,
      confidence,
      confidenceLabel: initiativeConfidenceLabel(confidence),
      evidence: [detail],
      priority: priorityLevel,
      priorityLabel: initiativePriorityLabel(priorityLevel),
      primaryCtaLabel: "Review",
      primaryCtaHref: card.href,
    })
  }

  if (recommendations.length === 0 && dashboard.welcome.recommendedAction) {
    const action = sanitizeHomeNarrative(dashboard.welcome.recommendedAction)
    recommendations.push({
      id: "initiative-welcome",
      category: "opportunities",
      headline: recommendBecause(action, "this is the highest-impact move based on your current queue"),
      whyItMatters: "Clears friction and unlocks the next outreach wave.",
      recommendedAction: action,
      confidence: "medium",
      confidenceLabel: initiativeConfidenceLabel("medium"),
      evidence: ["Recommended action from workspace dashboard welcome state."],
      priority: "worth_reviewing",
      priorityLabel: initiativePriorityLabel("worth_reviewing"),
      primaryCtaLabel: "Review",
      primaryCtaHref: metricHref(dashboard, "my-queue", "Leads needing action"),
    })
  }

  const deduped = new Map<string, GrowthHomeInitiativeRecommendation>()
  for (const row of recommendations) {
    if (!deduped.has(row.id)) deduped.set(row.id, row)
  }

  return [...deduped.values()].slice(0, 8)
}

export function buildBusinessAwareness(
  dashboard: GrowthWorkspaceDashboardViewModel,
  executiveBrief: GrowthHomeExecutiveBrief,
): GrowthHomeBusinessAwareness {
  const briefing = dashboard.briefing
  const meetingsThisWeek = briefing?.meetings.meetings_this_week ?? 0
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  const pipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const primaryObjective = briefing?.priorities?.[0]

  return {
    thisWeek: meetingsThisWeek > 0
      ? { label: "This Week", value: `${meetingsThisWeek} ${pluralize(meetingsThisWeek, "meeting", "meetings")} scheduled` }
      : emailsSent > 0
        ? { label: "This Week", value: `${emailsSent} outreach ${pluralize(emailsSent, "action", "actions")} completed` }
        : null,
    thisMonth: pipeline > 0
      ? { label: "This Month", value: `${formatHomeCurrency(pipeline)} weighted pipeline` }
      : replies > 0
        ? { label: "This Month", value: `${replies} prospect ${pluralize(replies, "reply", "replies")} received` }
        : null,
    currentObjective: primaryObjective
      ? {
          label: "Current Objective",
          detail: sanitizeHomeNarrative(primaryObjective.title),
          href: primaryObjective.href,
        }
      : executiveBrief.todaysPriority
        ? {
            label: "Current Objective",
            detail: executiveBrief.todaysPriority,
            href: executiveBrief.suggestedNextAction.href,
          }
        : null,
    topWin: executiveBrief.biggestWin,
    biggestRisk: executiveBrief.biggestRisk,
  }
}

export function buildProactiveCheckInFields(
  dashboard: GrowthWorkspaceDashboardViewModel,
  urgentCount: number,
) {
  return {
    foundIntro: AI_PROACTIVE_FOUND_INTRO,
    foundObservations: buildFoundObservations(dashboard),
    calmLine: proactiveCalmLine(urgentCount),
  }
}
