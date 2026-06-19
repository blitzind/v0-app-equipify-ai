import type { GrowthCampaignsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-campaigns-hub-metrics-client"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"

export type GrowthCampaignsHubHealthStatus = "green" | "yellow" | "red" | "neutral"

export type GrowthCampaignsHubHealthItem = {
  id: string
  emoji: string
  label: string
  count: number
  href: string
  status: GrowthCampaignsHubHealthStatus
}

export function buildGrowthCampaignsHubHealthItems(
  metrics: GrowthCampaignsHubMetricsSnapshot,
): GrowthCampaignsHubHealthItem[] {
  return [
    {
      id: "running-normally",
      emoji: "🟢",
      label: "Running Normally",
      count: metrics.runningNormally,
      href: GROWTH_CAMPAIGNS_HUB_HREF,
      status: "green",
    },
    {
      id: "needs-attention",
      emoji: "🟡",
      label: "Needs Attention",
      count: metrics.needsAttention,
      href: `${GROWTH_CAMPAIGNS_HUB_HREF}#my-tasks`,
      status: "yellow",
    },
    {
      id: "stalled",
      emoji: "🔴",
      label: "Stalled Campaigns",
      count: metrics.stalledCampaigns,
      href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
      status: "red",
    },
    {
      id: "meetings-booked",
      emoji: "📅",
      label: "Meetings Booked",
      count: metrics.meetingsBooked,
      href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
      status: "neutral",
    },
  ]
}
