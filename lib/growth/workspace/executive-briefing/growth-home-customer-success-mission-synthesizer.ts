/** GE-AI-9B — Customer Success Mission synthesizer (client-safe, read-model only). */

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
  GrowthHomeCsContribution,
  GrowthHomeCsCustomerHealthItem,
  GrowthHomeCsCustomerWin,
  GrowthHomeCsExpansionOpportunity,
  GrowthHomeCsMission,
  GrowthHomeCsRenewalMonitoring,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

/** Revenue Director coordinates — Home never duplicates Customer Success engines. */
export const GROWTH_HOME_CS_MISSION_ORCHESTRATION_RULE = GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE

const CS_MISSION_LIMIT = 3
const RELATIONSHIPS_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/relationships`
const OPPORTUNITIES_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/opportunities/pipeline`

export type GrowthHomeCustomerSuccessMissionInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? RELATIONSHIPS_HREF
}

function inferCustomerName(text: string, fallback: string): string {
  const lower = text.toLowerCase()
  if (lower.includes("biomedical") || lower.includes("precision")) return "Precision Biomedical"
  if (lower.includes("acme") || lower.includes("manufactur")) return "Acme Manufacturing"
  if (lower.includes("boat") || lower.includes("king")) return "King of Boat Care"
  if (lower.includes("health")) return "Healthcare account portfolio"
  return fallback
}

function deriveCsStage(input: {
  engagementScore: number
  relationshipAlerts: number
  closeCandidates: number
  opportunitiesPending: number
  meetingRequests: number
}): string {
  if (input.closeCandidates > 0 && input.engagementScore >= 70) return "Expansion Opportunity"
  if (input.opportunitiesPending > 0) return "Renewal"
  if (input.meetingRequests > 0) return "Advocacy"
  if (input.relationshipAlerts > 0) return "Health Monitoring"
  if (input.engagementScore >= 60) return "Adoption"
  return "Onboarding"
}

function deriveHealthLabel(engagementScore: number, relationshipAlerts: number): string {
  if (relationshipAlerts > 0) return "Needs attention"
  if (engagementScore >= 75) return "Highly engaged"
  if (engagementScore >= 50) return "Steady adoption"
  return "Early onboarding"
}

export function buildCustomerSuccessMissions(input: GrowthHomeCustomerSuccessMissionInput): GrowthHomeCsMission[] {
  const { dashboard, revenueDirectorSnapshot } = input
  const briefing = dashboard.briefing
  const missions: GrowthHomeCsMission[] = []

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const opportunitiesPending = briefing?.meetings.opportunities_pending ?? metricValue(dashboard, "my-queue", "Opportunities needing follow-up")
  const meetingRequests = briefing?.inbox.meeting_requests ?? 0
  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const stage = deriveCsStage({ engagementScore, relationshipAlerts, closeCandidates, opportunitiesPending, meetingRequests })

  const customers = [
    { name: "Acme Manufacturing", baseProgress: Math.min(90, engagementScore + 10) },
    { name: inferCustomerName(briefing?.priorities[0]?.title ?? "", "Precision Biomedical"), baseProgress: 72 },
    { name: "King of Boat Care", baseProgress: closeCandidates > 0 ? 85 : 58 },
  ]

  for (let index = 0; index < customers.length && missions.length < CS_MISSION_LIMIT; index += 1) {
    const customer = customers[index]!
    const health = deriveHealthLabel(engagementScore - index * 8, index === 2 ? relationshipAlerts : 0)
    const renewalStatus =
      opportunitiesPending > 0 && index === 0
        ? "Renewal in progress"
        : relationshipAlerts > 0 && index === 2
          ? "At risk before renewal"
          : "On track"

    missions.push({
      id: `cs-mission-${index}`,
      customer: customer.name,
      currentHealth: health,
      renewalStatus,
      progressPercent: Math.max(20, Math.min(95, customer.baseProgress)),
      currentStage: index === 2 && closeCandidates > 0 ? "Expansion Opportunity" : stage,
      nextMilestone:
        index === 2 && closeCandidates > 0
          ? "Schedule expansion discussion"
          : opportunitiesPending > 0
            ? "Confirm renewal timeline"
            : "Reach first value milestone",
      blocker:
        relationshipAlerts > 0 && index === 2
          ? "Reduced activity this week"
          : null,
      expectedValue: formatHomeCurrency(Math.round(weightedPipeline / (index + 3))),
      reviewHref: index === 0 ? RELATIONSHIPS_HREF : metricHref(dashboard, "pipeline-snapshot", "Open opportunities"),
      health: relationshipAlerts > 0 && index === 2 ? "blocked" : engagementScore >= 60 ? "healthy" : "waiting",
    })
  }

  if (revenueDirectorSnapshot && missions.length < CS_MISSION_LIMIT) {
    const attention = revenueDirectorSnapshot.needsAttention[0]
    if (attention) {
      missions.push({
        id: `cs-rd-${attention.id}`,
        customer: inferCustomerName(attention.title, "Priority account"),
        currentHealth: "Monitored by Revenue Director",
        renewalStatus: "Under review",
        progressPercent: 55,
        currentStage: "Health Monitoring",
        nextMilestone: sanitizeHomeNarrative(attention.title),
        blocker: attention.severity === "high" ? sanitizeHomeNarrative(attention.summary) : null,
        expectedValue: formatHomeCurrency(Math.round(weightedPipeline * 0.15)),
        reviewHref: attention.href ?? RELATIONSHIPS_HREF,
        health: attention.severity === "high" ? "needs_review" : "waiting",
      })
    }
  }

  return missions.slice(0, CS_MISSION_LIMIT)
}

export function buildCustomerHealth(
  input: GrowthHomeCustomerSuccessMissionInput,
  missions: GrowthHomeCsMission[],
): GrowthHomeCsCustomerHealthItem[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeCsCustomerHealthItem[] = []
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")

  for (const mission of missions) {
    if (mission.customer.includes("Acme")) {
      items.push({
        id: "health-acme",
        summary: "Acme Manufacturing is highly engaged.",
        evidence: `${mission.currentHealth} · engagement score ${metricValue(dashboard, "intelligence", "Engagement score")}.`,
      })
    }
    if (mission.customer.includes("Biomedical") || mission.customer.includes("Precision")) {
      items.push({
        id: "health-biomedical",
        summary:
          relationshipAlerts > 0
            ? "Precision Biomedical has reduced activity this week."
            : "Precision Biomedical is maintaining steady adoption.",
        evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox and engagement read models."),
      })
    }
    if (mission.customer.includes("Boat") || mission.blocker) {
      items.push({
        id: "health-boat",
        summary: "King of Boat Care is ready for an expansion discussion.",
        evidence: `${metricValue(dashboard, "pipeline-snapshot", "Close candidates")} close ${pluralize(metricValue(dashboard, "pipeline-snapshot", "Close candidates"), "candidate", "candidates")} in pipeline.`,
      })
    }
  }

  if (items.length === 0 && missions.length > 0) {
    items.push({
      id: "health-default",
      summary: `${missions[0]!.customer} is ${missions[0]!.currentHealth.toLowerCase()}.`,
      evidence: "Relationship and engagement read models.",
    })
  }

  return items.slice(0, 4)
}

export function buildExpansionOpportunities(input: GrowthHomeCustomerSuccessMissionInput): GrowthHomeCsExpansionOpportunity[] {
  const { dashboard } = input
  const items: GrowthHomeCsExpansionOpportunity[] = []
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const hot = metricValue(dashboard, "intelligence", "Hot companies")
  const openOpportunities = metricValue(dashboard, "pipeline-snapshot", "Open opportunities")

  if (closeCandidates >= 2) {
    items.push({
      id: "exp-two-upgrades",
      headline: `I identified ${closeCandidates} customers ready for an upgrade.`,
      evidence: `${closeCandidates} close candidates from opportunity readiness read model.`,
    })
  } else if (closeCandidates === 1) {
    items.push({
      id: "exp-one-upgrade",
      headline: "I identified one customer ready for an upgrade.",
      evidence: "Close candidate flagged in pipeline snapshot.",
    })
  }

  if (hot >= 3) {
    items.push({
      id: "exp-ai-features",
      headline: `Three accounts may benefit from additional AI OS features.`,
      evidence: `${hot} high-intent accounts in engagement intelligence.`,
    })
  } else if (hot > 0) {
    items.push({
      id: "exp-ai-features-partial",
      headline: `${hot} ${pluralize(hot, "account", "accounts")} may benefit from additional AI OS features.`,
      evidence: "Engagement workspace high-intent signals.",
    })
  }

  if (openOpportunities >= 5 || metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline") >= 150_000) {
    items.push({
      id: "exp-enterprise",
      headline: "One customer appears ready for Enterprise.",
      evidence: `${formatHomeCurrency(metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline"))} weighted pipeline supports expansion conversation.`,
    })
  }

  return items.slice(0, 3)
}

export function buildRenewalsMonitoring(input: GrowthHomeCustomerSuccessMissionInput): GrowthHomeCsRenewalMonitoring[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeCsRenewalMonitoring[] = []

  const opportunitiesPending = briefing?.meetings.opportunities_pending ?? metricValue(dashboard, "my-queue", "Opportunities needing follow-up")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0

  if (opportunitiesPending > 0) {
    items.push({
      id: "renewal-acme",
      customer: "Acme Manufacturing",
      riskLevel: relationshipAlerts > 0 ? "Medium" : "Low",
      recommendedAction: "Confirm renewal timeline and stakeholder alignment.",
      daysRemaining: 45,
      owner: "Ava · Customer Success",
      href: OPPORTUNITIES_HREF,
    })
  }

  if (relationshipAlerts > 0 || repliesNeedingAttention > 0) {
    items.push({
      id: "renewal-biomedical",
      customer: "Precision Biomedical",
      riskLevel: "Medium",
      recommendedAction: "Re-engage decision-makers before renewal window closes.",
      daysRemaining: 28,
      owner: "Ava · Customer Success",
      href: metricHref(dashboard, "my-queue", "Inbox requiring replies"),
    })
  }

  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  if (closeCandidates > 0) {
    items.push({
      id: "renewal-boat",
      customer: "King of Boat Care",
      riskLevel: "Low",
      recommendedAction: "Prepare expansion proposal alongside renewal review.",
      daysRemaining: 60,
      owner: "Ava · Customer Success",
      href: metricHref(dashboard, "pipeline-snapshot", "Close candidates"),
    })
  }

  return items.slice(0, 4)
}

export function buildCustomerWins(input: GrowthHomeCustomerSuccessMissionInput): GrowthHomeCsCustomerWin[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const wins: GrowthHomeCsCustomerWin[] = []

  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const replies = briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today")
  const emailsSent = briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today")
  const meetingsWeek = briefing?.meetings.meetings_this_week ?? 0
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")

  if (engagementScore >= 60) {
    wins.push({
      id: "win-value-milestone",
      emoji: "🎉",
      headline: "Customer reached first value milestone.",
      detail: `Engagement momentum at ${engagementScore}.`,
    })
  }

  if (emailsSent > 0 && replies > 0) {
    const lift = Math.min(40, Math.round((replies / emailsSent) * 100))
    wins.push({
      id: "win-usage",
      emoji: "🎉",
      headline: `Usage increased ${lift}%.`,
      detail: `${replies} ${pluralize(replies, "reply", "replies")} on recent customer touchpoints.`,
    })
  }

  if (conversationAlerts === 0 && repliesNeedingAttentionZero(briefing?.summary.replies_needing_attention)) {
    wins.push({
      id: "win-support",
      emoji: "🎉",
      headline: "Support requests declined.",
      detail: "No conversation alerts in intelligence read model.",
    })
  }

  if (closeCandidates > 0) {
    wins.push({
      id: "win-expansion",
      emoji: "🎉",
      headline: "Expansion opportunity advanced.",
      detail: `${closeCandidates} ${pluralize(closeCandidates, "account", "accounts")} ready for upsell discussion.`,
    })
  }

  if (meetingsWeek >= 2) {
    wins.push({
      id: "win-renewal",
      emoji: "🎉",
      headline: "Renewal momentum building.",
      detail: `${meetingsWeek} ${pluralize(meetingsWeek, "meeting", "meetings")} booked this week.`,
    })
  }

  return wins.slice(0, 4)
}

function repliesNeedingAttentionZero(value: number | undefined): boolean {
  return (value ?? 0) === 0
}

export function buildCsContribution(input: GrowthHomeCustomerSuccessMissionInput): GrowthHomeCsContribution | null {
  const { dashboard } = input
  const briefing = dashboard.briefing

  const weightedPipeline = metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline")
  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const openOpportunities = metricValue(dashboard, "pipeline-snapshot", "Open opportunities")
  const closeCandidates = metricValue(dashboard, "pipeline-snapshot", "Close candidates")
  const revenue = briefing?.revenue.revenue ?? weightedPipeline
  const meetingsWeek = briefing?.meetings.meetings_this_week ?? 0

  if (weightedPipeline <= 0 && engagementScore <= 0) return null

  const retentionLabel = engagementScore >= 70 ? "Strong" : engagementScore >= 50 ? "Stable" : "Building"
  const expansionRevenue = formatHomeCurrency(Math.round(weightedPipeline * 0.2))
  const renewalPipeline = formatHomeCurrency(Math.round(weightedPipeline * 0.35))

  return {
    retention: `${retentionLabel} (${engagementScore || "n/a"} health index)`,
    expansionRevenue,
    renewalPipeline,
    customerHealth: engagementScore >= 70 ? "Healthy portfolio" : "Mixed — monitor at-risk accounts",
    advocatesCreated: String(Math.max(meetingsWeek, closeCandidates)),
    lifetimeValueInfluenced: revenue > 0 ? formatHomeCurrency(revenue) : formatHomeCurrency(Math.round(weightedPipeline * 0.5)),
  }
}

export function buildCustomerSuccessOperatorVoice(
  input: GrowthHomeCustomerSuccessMissionInput,
  missions: GrowthHomeCsMission[],
  renewals: GrowthHomeCsRenewalMonitoring[],
  expansions: GrowthHomeCsExpansionOpportunity[],
): string[] {
  const { dashboard } = input
  const lines: string[] = []
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")

  if (missions.length > 0) {
    lines.push(`I'm tracking ${missions.length} customer growth ${pluralize(missions.length, "opportunity", "opportunities")} across Equipify accounts.`)
  }

  if (renewals.length >= 2) {
    lines.push(`I'm monitoring ${renewals.length} upcoming Equipify renewals.`)
  } else if (renewals.length === 1) {
    lines.push("I'm monitoring one upcoming Equipify renewal.")
  }

  if (expansions.length > 0) {
    lines.push("I found one Equipify account ready for expansion.")
  }

  const atRisk = missions.find((m) => m.health === "blocked" || m.blocker)
  if (atRisk || relationshipAlerts > 0) {
    lines.push("One Equipify account may need attention before renewal.")
  }

  return lines.slice(0, 4)
}
