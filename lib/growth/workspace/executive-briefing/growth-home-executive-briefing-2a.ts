/** GE-GROWTH-HOME-EXECUTIVE-BRIEFING-2A — Executive briefing presentation helpers (client-safe). */

import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type {
  GrowthHomeAiOsUxViewModel,
  GrowthHomeExecutiveBriefingHero,
  GrowthHomeTimelinePeriod,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
export const GROWTH_HOME_EXECUTIVE_BRIEFING_2A_QA_MARKER = "ge-growth-home-executive-briefing-2a-v1" as const

export const GROWTH_HOME_AVA_OPERATOR_TAGLINE = "Equipify's AI Growth Operator" as const
export const GROWTH_HOME_EXECUTIVE_SNAPSHOT_TITLE = "Where things stand" as const
export const GROWTH_HOME_TODAYS_FOCUS_TITLE = "Today's focus" as const
export const GROWTH_HOME_REVIEW_TODAYS_WORK_LABEL = "Review Today's Work" as const
export const GROWTH_HOME_VIEW_MISSION_CENTER_LABEL = "View Mission Center" as const
export { GROWTH_HOME_DECISION_QUEUE_EMPTY_MESSAGE as GROWTH_HOME_NOTHING_REQUIRES_APPROVAL } from "@/lib/growth/workspace/executive-briefing/growth-home-decision-queue-dedup"
export const GROWTH_HOME_GROWTH_STRATEGY_TITLE = "Growth Strategy" as const

export type GrowthHomeExecutiveSnapshotKpi = {
  id: string
  label: string
  value: string
}

export type GrowthHomeActivityFeedItem = {
  id: string
  periodLabel: string
  description: string
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

export function resolveAvaStatusBadgeLabel(statusLabel: string): string {
  const lower = statusLabel.toLowerCase()
  if (lower.includes("waiting") || lower.includes("approval") || lower.includes("review")) return "Ready for review"
  if (lower.includes("idle") || lower.includes("caught")) return "Idle"
  return "Working"
}

/**
 * GE-AIOS-7A — Revenue Queue summary strip.
 * Reduced from five mixed KPIs to the four operator-relevant signals:
 * Revenue Queue, Needs Review, Replies Waiting, Today's Focus.
 * Reuses existing dashboard read models — no new data sources.
 */
export function buildExecutiveSnapshotKpis(input: {
  hero: GrowthHomeExecutiveBriefingHero
  aiOsUx: GrowthHomeAiOsUxViewModel
  dashboard: GrowthWorkspaceDashboardViewModel
}): GrowthHomeExecutiveSnapshotKpi[] {
  const { aiOsUx, dashboard } = input
  const briefing = dashboard.briefing

  const revenueQueue = Math.max(
    metricValue(dashboard, "my-queue", "Leads needing action"),
    metricValue(dashboard, "my-queue", "Call-ready leads"),
  )
  const needsReview = aiOsUx.approveItemsCount
  const repliesWaiting = Math.max(
    metricValue(dashboard, "my-queue", "Inbox requiring replies"),
    metricValue(dashboard, "activity", "Replies today"),
  )
  const todaysFocus = aiOsUx.dailyWorkQueue.length

  return [
    { id: "revenue-queue", label: "Revenue Queue", value: String(revenueQueue) },
    { id: "needs-review", label: "Needs Review", value: String(needsReview) },
    { id: "replies-waiting", label: "Replies Waiting", value: String(repliesWaiting) },
    { id: "todays-focus", label: "Today's Focus", value: String(todaysFocus) },
  ]
}

export function buildHeroNarrativeSummary(marketingMissionCount: number, hero: GrowthHomeExecutiveBriefingHero): string {
  if (marketingMissionCount > 0) {
    const noun = marketingMissionCount === 1 ? "growth initiative" : "growth initiatives"
    return `I'm currently running ${marketingMissionCount} ${noun} to sell Equipify.`
  }
  return hero.introLine
}

export function buildHeroBriefingBullets(input: {
  hero: GrowthHomeExecutiveBriefingHero
  aiOsUx: GrowthHomeAiOsUxViewModel
}): string[] {
  const { hero, aiOsUx } = input
  const bullets = [...hero.todayAtAGlance]

  if (bullets.length === 0) {
    for (const metric of hero.revenueToday.slice(0, 3)) {
      bullets.push(`${metric.label}: ${metric.value}`)
    }
  }

  if (aiOsUx.waitingOnYou.length === 0 && aiOsUx.approveItemsCount === 0) {
    bullets.push("Nothing urgent requires your attention today.")
  }

  return bullets.slice(0, 5)
}

export function buildTodaysFocusItems(input: {
  hero: GrowthHomeExecutiveBriefingHero
  aiOsUx: GrowthHomeAiOsUxViewModel
}): string[] {
  const items: string[] = []
  const { hero, aiOsUx } = input

  if (hero.riskAction?.title) items.push(hero.riskAction.title)
  if (hero.opportunityAction?.title) items.push(hero.opportunityAction.title)

  for (const item of aiOsUx.dailyWorkQueue.slice(0, 3)) {
    items.push(item.actionLabel)
  }

  return [...new Set(items)].slice(0, 4)
}

export function buildActivityFeedItems(periods: GrowthHomeTimelinePeriod[]): GrowthHomeActivityFeedItem[] {
  return periods.flatMap((period) =>
    period.items.map((description, index) => ({
      id: `${period.id}-${index}`,
      periodLabel: period.periodLabel,
      description,
    })),
  )
}

export function parseEmailsFromMarketingCopy(copy: string): string | null {
  const match = copy.match(/(\d+)\s+executions today/i)
  if (match?.[1]) return `${match[1]} sent`
  const replyMatch = copy.match(/(\d+)\s+repl/i)
  if (replyMatch?.[1]) return `${replyMatch[1]} replies`
  return null
}
