/** Deterministic Leads operator recommendations — metadata only, no autonomous actions. */

import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import type { GrowthLeadsActivityItem } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import type { GrowthLeadsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-leads-hub-metrics-client"
import {
  GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
  GROWTH_LEADS_HUB_RESEARCH_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_LEADS_HUB_RECOMMENDATIONS_QA_MARKER = "growth-leads-hub-recommendations-v3" as const

export type GrowthLeadsHubRecommendationSeverity = "HIGH" | "MEDIUM" | "LOW"

export type GrowthLeadsHubRecommendation = {
  id: string
  label: string
  detail: string
  timestampLabel: string
  severity: GrowthLeadsHubRecommendationSeverity
  href: string
}

function deterministicEngagementScore(metrics: GrowthLeadsHubMetricsSnapshot): number {
  const base = 70 + Math.min(metrics.readyToCall ?? 0, 5) * 6
  return Math.min(99, base)
}

export function buildGrowthLeadsHubRecommendations(input: {
  metrics: GrowthLeadsHubMetricsSnapshot
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[]
  recentActivity?: GrowthLeadsActivityItem[]
}): GrowthLeadsHubRecommendation[] {
  const items: GrowthLeadsHubRecommendation[] = []

  if ((input.metrics.readyToCall ?? 0) > 0) {
    const name = input.metrics.nextReadyCallLabel ?? "next lead"
    items.push({
      id: "call-queue-next",
      label: `Call ${name}`,
      detail: `${deterministicEngagementScore(input.metrics)} engagement score`,
      timestampLabel: "2 minutes ago",
      severity: "HIGH",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`,
    })
  }

  const hotSaved = [...input.savedSearches]
    .filter((row) => (row.workflow.resultCount ?? 0) >= 25)
    .sort((a, b) => (b.workflow.resultCount ?? 0) - (a.workflow.resultCount ?? 0))[0]

  if (hotSaved) {
    items.push({
      id: `saved-search-${hotSaved.id}`,
      label: `Review ${hotSaved.name}`,
      detail: hotSaved.workflow.lastRefreshedAt != null ? "Research completed" : "Saved search results ready",
      timestampLabel: "15 minutes ago",
      severity: "MEDIUM",
      href: `${GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}?savedSearchId=${encodeURIComponent(hotSaved.id)}`,
    })
  }

  const sharePageActivity = (input.recentActivity ?? []).find((item) => item.href.includes("/share-pages"))
  if (sharePageActivity) {
    items.push({
      id: `follow-up-${sharePageActivity.id}`,
      label: `Follow up with ${sharePageActivity.label}`,
      detail: "Viewed share page recently",
      timestampLabel: "1 hour ago",
      severity: "MEDIUM",
      href: sharePageActivity.href,
    })
  } else if ((input.metrics.followUpsOverdue ?? 0) > 0) {
    items.push({
      id: "follow-up-queue",
      label: `Follow up on ${input.metrics.followUpsOverdue} overdue lead${input.metrics.followUpsOverdue === 1 ? "" : "s"}`,
      detail: "High-priority follow-ups waiting",
      timestampLabel: "30 minutes ago",
      severity: "HIGH",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/leads/queue`,
    })
  }

  if ((input.metrics.accountsAwaitingResearch ?? 0) > 0 && items.length < 4) {
    items.push({
      id: "review-revenue-queue",
      label: `Triage ${input.metrics.accountsAwaitingResearch} account${input.metrics.accountsAwaitingResearch === 1 ? "" : "s"} awaiting research`,
      detail: "Revenue queue needs review",
      timestampLabel: "1 hour ago",
      severity: "LOW",
      href: GROWTH_LEADS_HUB_RESEARCH_HREF,
    })
  }

  if (items.length === 0) {
    return [
      {
        id: "start-prospect-search",
        label: "Start with Prospect Search",
        detail: "Discover new accounts to work",
        timestampLabel: "Ready now",
        severity: "LOW",
        href: GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF,
      },
      {
        id: "open-revenue-queue",
        label: "Open the revenue queue",
        detail: "Triage prioritized accounts",
        timestampLabel: "Ready now",
        severity: "LOW",
        href: GROWTH_LEADS_HUB_RESEARCH_HREF,
      },
    ]
  }

  return items.slice(0, 4)
}
