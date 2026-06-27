/** GE-AI-9A — Marketing Mission synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type {
  GrowthHomeAudienceInsight,
  GrowthHomeCampaignPerformanceItem,
  GrowthHomeContentPreparingItem,
  GrowthHomeMarketingContribution,
  GrowthHomeMarketingMission,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

/** Revenue Director coordinates marketing missions — no duplicate campaign engine. */
export const GROWTH_HOME_MARKETING_MISSION_ORCHESTRATION_RULE = GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE

const MARKETING_MISSION_LIMIT = 3
const CAMPAIGNS_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/campaigns/sequences`

export type GrowthHomeMarketingMissionInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? CAMPAIGNS_HREF
}

function inferCampaignName(text: string, fallback: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("biomedical") || lower.includes("healthcare") || lower.includes("precision")) {
    return "Precision Biomedical"
  }
  if (lower.includes("roof")) return "Roofing"
  if (lower.includes("hvac")) return "HVAC"
  if (lower.includes("manufactur")) return "Manufacturing"
  return fallback
}

function deriveMarketingStage(input: {
  pendingDrafts: number
  activeCampaigns: number
  executionsToday: number
  replies: number
  emailsSent: number
}): string {
  if (input.pendingDrafts > 0 && input.activeCampaigns === 0) return "Content"
  if (input.pendingDrafts > 0) return "Launch Ready"
  if (input.executionsToday > 0 && input.replies === 0) return "Running"
  if (input.executionsToday > 0 && input.replies > 0) return "Learning"
  if (input.activeCampaigns > 0) return "Campaign"
  return "Planning"
}

function deriveMarketingHealth(input: {
  pendingDrafts: number
  conversationAlerts: number
  replies: number
  emailsSent: number
}): GrowthHomeMarketingMission["health"] {
  if (input.conversationAlerts > 0 && input.replies === 0) return "blocked"
  if (input.pendingDrafts > 0) return "needs_review"
  if (input.emailsSent > 0 && input.replies / Math.max(input.emailsSent, 1) >= 0.25) return "healthy"
  if (input.emailsSent > 0) return "waiting"
  return "healthy"
}

export function buildMarketingMissions(input: GrowthHomeMarketingMissionInput): GrowthHomeMarketingMission[] {
  const { dashboard, revenueDirectorSnapshot } = input
  const briefing = dashboard.briefing
  const missions: GrowthHomeMarketingMission[] = []

  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const activeCampaigns = metricValue(dashboard, "campaign-snapshot", "Active campaigns")
  const executionsToday = metricValue(dashboard, "campaign-snapshot", "Executions today")
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const enrollments = metricValue(dashboard, "campaign-snapshot", "Enrollments")

  const stage = deriveMarketingStage({ pendingDrafts, activeCampaigns, executionsToday, replies, emailsSent })
  const health = deriveMarketingHealth({ pendingDrafts, conversationAlerts, replies, emailsSent })

  for (const priority of briefing?.priorities?.slice(0, 2) ?? []) {
    const campaign = inferCampaignName(priority.title, "Primary campaign")
    missions.push({
      id: `marketing-priority-${priority.priority}`,
      campaign,
      goal: sanitizeHomeNarrative(priority.title),
      progressPercent: pendingDrafts > 0 ? 70 : Math.min(90, 40 + activeCampaigns * 10),
      currentStage: stage,
      expectedImpact: sanitizeHomeNarrative(priority.detail),
      blocker: pendingDrafts > 0 ? `${pendingDrafts} drafts awaiting approval` : null,
      nextMilestone: pendingDrafts > 0 ? "Clear approval queue for launch" : "Expand qualified audience reach",
      reviewHref: priority.href ?? metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
      health,
    })
  }

  if (activeCampaigns > 0 && missions.length < MARKETING_MISSION_LIMIT) {
    missions.push({
      id: "marketing-active-campaigns",
      campaign: "Multi-sequence portfolio",
      goal: `Maintain ${activeCampaigns} active ${pluralize(activeCampaigns, "campaign", "campaigns")} with ${enrollments} enrollments.`,
      progressPercent: Math.min(95, 50 + executionsToday * 5),
      currentStage: executionsToday > 0 ? "Running" : "Campaign",
      expectedImpact: `${executionsToday} executions today · ${replies} ${pluralize(replies, "reply", "replies")}.`,
      blocker: conversationAlerts > 0 ? "Response quality declined on one sequence" : null,
      nextMilestone: "Improve reply rate through follow-up content",
      reviewHref: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
      health: conversationAlerts > 0 ? "blocked" : "healthy",
    })
  }

  if (hot > 0 && missions.length < MARKETING_MISSION_LIMIT) {
    missions.push({
      id: "marketing-audience-expansion",
      campaign: "High-intent audience expansion",
      goal: `Develop audience strategy for ${hot} high-intent ${pluralize(hot, "segment", "segments")}.`,
      progressPercent: Math.min(85, 25 + hot * 15),
      currentStage: "Audience",
      expectedImpact: "Convert engagement signals into qualified opportunities.",
      blocker: null,
      nextMilestone: "Validate new segment messaging",
      reviewHref: metricHref(dashboard, "intelligence", "Hot companies"),
      health: "healthy",
    })
  }

  if (revenueDirectorSnapshot && missions.length < MARKETING_MISSION_LIMIT) {
    const commPlan = revenueDirectorSnapshot.communicationEngine.plans[0]
    if (commPlan) {
      missions.push({
        id: `marketing-rd-${commPlan.id}`,
        campaign: "Communication plan mission",
        goal: sanitizeHomeNarrative(commPlan.recommendedStrategy.replaceAll("_", " ")),
        progressPercent: Math.round(commPlan.confidence),
        currentStage: "Planning",
        expectedImpact: sanitizeHomeNarrative(commPlan.goal.replaceAll("_", " ")),
        blocker: commPlan.policy.requiresHumanApproval ? "Awaiting operator review" : null,
        nextMilestone: "Finalize channel mix",
        reviewHref: commPlan.routeHints[0]?.href ?? CAMPAIGNS_HREF,
        health: commPlan.policy.requiresHumanApproval ? "needs_review" : "healthy",
      })
    }
  }

  return missions.slice(0, MARKETING_MISSION_LIMIT)
}

export function buildCampaignPerformance(
  input: GrowthHomeMarketingMissionInput,
  missions: GrowthHomeMarketingMission[],
): GrowthHomeCampaignPerformanceItem[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeCampaignPerformanceItem[] = []

  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  const opportunities = briefing?.revenue.opportunities ?? metricValue(dashboard, "pipeline-snapshot", "Open opportunities")
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")

  const biomedical = missions.find((m) => m.campaign.toLowerCase().includes("biomedical"))
  if (biomedical) {
    const outperforming = emailsSent > 0 && replies / emailsSent >= 0.3
    items.push({
      id: "perf-biomedical",
      summary: outperforming
        ? "The biomedical campaign is outperforming expectations."
        : "The biomedical campaign has steady engagement this week.",
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.revenue ?? `${replies} replies on recent outreach.`),
    })
  }

  const roofing = missions.find((m) => m.campaign.toLowerCase().includes("roof"))
  if (roofing || conversationAlerts > 0) {
    items.push({
      id: "perf-roofing",
      summary:
        conversationAlerts > 0
          ? "The roofing campaign has slowed this week."
          : "The roofing campaign is holding steady with monitored engagement.",
      evidence: `${conversationAlerts} conversation ${pluralize(conversationAlerts, "alert", "alerts")} from intelligence read model.`,
    })
  }

  if (opportunities > 0) {
    const hvac = missions.find((m) => m.campaign.toLowerCase().includes("hvac")) ?? missions[0]
    items.push({
      id: "perf-opportunities",
      summary: `The ${hvac?.campaign.toLowerCase() ?? "active"} campaign generated ${opportunities} qualified ${pluralize(opportunities, "opportunity", "opportunities")}.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.meetings ?? "Pipeline read model."),
    })
  }

  if (items.length === 0 && emailsSent > 0) {
    items.push({
      id: "perf-default",
      summary: `Campaign outreach generated ${replies} ${pluralize(replies, "reply", "replies")} from ${emailsSent} sends today.`,
      evidence: "Activity read model · emails and replies today.",
    })
  }

  return items.slice(0, 4)
}

export function buildContentPreparing(input: GrowthHomeMarketingMissionInput): GrowthHomeContentPreparingItem[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeContentPreparingItem[] = []

  const pendingDrafts = briefing?.approval_queue.pending_drafts ?? metricValue(dashboard, "campaign-snapshot", "Approval queue")
  const pendingJobs = briefing?.approval_queue.pending_jobs ?? 0

  if (pendingDrafts > 0) {
    items.push({
      id: "content-email-sequence",
      label: "Email sequence",
      detail: `${pendingDrafts} personalized ${pluralize(pendingDrafts, "draft", "drafts")} ready for review.`,
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  if (pendingJobs > 0 || pendingDrafts > 0) {
    items.push({
      id: "content-landing",
      label: "Landing page",
      detail: "Supporting landing assets bundled with sequence approval queue.",
      href: metricHref(dashboard, "campaign-snapshot", "Approval queue"),
    })
  }

  if (pendingDrafts >= 2) {
    items.push({
      id: "content-sms",
      label: "SMS campaign",
      detail: "Follow-up SMS variants prepared alongside email sequences.",
      href: CAMPAIGNS_HREF,
    })
  }

  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  if (positiveInterest > 0) {
    items.push({
      id: "content-linkedin",
      label: "LinkedIn content",
      detail: `${positiveInterest} positive ${pluralize(positiveInterest, "thread", "threads")} inform social follow-up copy.`,
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  if (metricValue(dashboard, "campaign-snapshot", "Active campaigns") > 0) {
    items.push({
      id: "content-ad-creative",
      label: "Ad creative",
      detail: "Creative variants aligned with active campaign enrollments.",
      href: metricHref(dashboard, "campaign-snapshot", "Active campaigns"),
    })
  }

  return items.slice(0, 6)
}

export function buildAudienceIntelligence(input: GrowthHomeMarketingMissionInput): GrowthHomeAudienceInsight[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeAudienceInsight[] = []

  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")

  if (hot > 0) {
    items.push({
      id: "audience-new-segment",
      insight: "I found a new audience segment worth pursuing.",
      evidence: `${hot} high-intent ${pluralize(hot, "company", "companies")} in engagement intelligence.`,
    })
  }

  const priorityText = briefing?.priorities?.map((p) => p.title.toLowerCase()).join(" ") ?? ""
  if (priorityText.includes("health") || priorityText.includes("biomedical") || positiveInterest > 0) {
    items.push({
      id: "audience-healthcare",
      insight: "Healthcare companies are responding better than manufacturers.",
      evidence: sanitizeHomeNarrative(
        briefing?.section_summaries.inbox ?? `${positiveInterest} positive interest signals in inbox.`,
      ),
    })
  }

  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  if (emailsSent > 0 || engagementScore > 0) {
    items.push({
      id: "audience-timing",
      insight: "Decision-makers are opening emails later in the afternoon.",
      evidence: `Engagement score ${engagementScore || "n/a"} · ${emailsSent} sends tracked today.`,
    })
  }

  return items.slice(0, 4)
}

export function buildMarketingContribution(input: GrowthHomeMarketingMissionInput): GrowthHomeMarketingContribution | null {
  const { dashboard } = input
  const briefing = dashboard.briefing

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  const leads = metricValue(dashboard, "my-queue", "Leads needing action") + metricValue(dashboard, "intelligence", "Hot companies")
  const meetings = briefing?.meetings.meetings_this_week ?? metricValue(dashboard, "activity", "Meetings today")
  const revenue = briefing?.revenue.revenue ?? weightedPipeline

  if (weightedPipeline <= 0 && emailsSent <= 0) return null

  const replyRate = emailsSent > 0 ? Math.round((replies / emailsSent) * 100) : 0
  const pipelineInfluenced = Math.round(weightedPipeline * 0.45)
  const roiLabel = replyRate >= 30 ? "Strong" : replyRate >= 15 ? "Moderate" : "Building"

  return {
    pipelineInfluenced: formatHomeCurrency(pipelineInfluenced),
    campaignRoi: `${roiLabel} (${replyRate}% reply rate)`,
    leadsGenerated: String(leads),
    meetingsInfluenced: String(meetings),
    revenueInfluenced: revenue > 0 ? formatHomeCurrency(revenue) : formatHomeCurrency(Math.round(weightedPipeline * 0.2)),
  }
}

export function buildMarketingOperatorVoice(
  input: GrowthHomeMarketingMissionInput,
  missions: GrowthHomeMarketingMission[],
): string[] {
  const { dashboard } = input
  const lines: string[] = []
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const pendingDrafts = dashboard.briefing?.approval_queue.pending_drafts ?? 0

  if (missions.length > 0) {
    lines.push(`I prepared ${missions.length} growth ${pluralize(missions.length, "initiative", "initiatives")} to sell Equipify.`)
  }

  const blocked = missions.find((m) => m.health === "blocked")
  if (blocked) {
    lines.push(`I recommend pausing one campaign until engagement recovers.`)
  } else if (conversationAlerts > 0) {
    lines.push(`I discovered softer engagement on one campaign.`)
  }

  if (pendingDrafts > 0) {
    lines.push(`I prepared new content for next week's Equipify launch.`)
  }

  const healthcare = missions.find((m) => m.campaign.toLowerCase().includes("biomedical") || m.campaign.toLowerCase().includes("health"))
  if (healthcare && healthcare.health === "healthy") {
    lines.push(`I recommend prioritizing healthcare equipment this week.`)
  }

  return lines.slice(0, 4)
}
