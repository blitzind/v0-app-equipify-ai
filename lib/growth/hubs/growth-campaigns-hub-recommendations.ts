/** Deterministic Campaigns operator recommendations — metadata only (UX-AUDIT-6). */

import type { GrowthCampaignsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-campaigns-hub-metrics-client"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_CAMPAIGNS_HUB_RECOMMENDATIONS_QA_MARKER = "growth-campaigns-hub-recommendations-v1" as const

export type GrowthCampaignsHubRecommendationSeverity = "HIGH" | "MEDIUM" | "LOW"

export type GrowthCampaignsHubRecommendation = {
  id: string
  label: string
  detail: string
  severity: GrowthCampaignsHubRecommendationSeverity
  href: string
}

export function buildGrowthCampaignsHubRecommendations(
  metrics: GrowthCampaignsHubMetricsSnapshot,
): GrowthCampaignsHubRecommendation[] {
  const items: GrowthCampaignsHubRecommendation[] = []

  if (metrics.repliesAwaitingReview > 0) {
    items.push({
      id: "review-replies",
      label: "Review new campaign replies",
      detail: `${metrics.repliesAwaitingReview} pending channel task${metrics.repliesAwaitingReview === 1 ? "" : "s"}`,
      severity: "HIGH",
      href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
    })
  }

  if (metrics.stalledCampaigns > 0) {
    items.push({
      id: "resume-paused",
      label: "Resume paused sequence",
      detail: `${metrics.stalledCampaigns} stalled or blocked campaign${metrics.stalledCampaigns === 1 ? "" : "s"}`,
      severity: "MEDIUM",
      href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
    })
  }

  if (metrics.overdueFollowUps > 0) {
    items.push({
      id: "overdue-follow-ups",
      label: "Clear overdue follow-ups",
      detail: `${metrics.overdueFollowUps} overdue task${metrics.overdueFollowUps === 1 ? "" : "s"}`,
      severity: "HIGH",
      href: `${GROWTH_CAMPAIGNS_HUB_HREF}#my-tasks`,
    })
  }

  if (metrics.meetingsBooked > 0 && items.length < 3) {
    items.push({
      id: "review-meetings",
      label: "Review booked meetings",
      detail: `${metrics.meetingsBooked} booking follow-up${metrics.meetingsBooked === 1 ? "" : "s"}`,
      severity: "MEDIUM",
      href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
    })
  }

  if (items.length < 3) {
    items.push({
      id: "post-demo-campaign",
      label: "Create post-demo campaign",
      detail: "Plan the next nurture sequence after demos",
      severity: "LOW",
      href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
    })
  }

  return items.slice(0, 4)
}
