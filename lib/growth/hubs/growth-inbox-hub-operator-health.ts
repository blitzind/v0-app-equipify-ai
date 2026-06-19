import type { GrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import {
  growthWorkspaceInboxViewHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"

export type GrowthInboxHubHealthStatus = "green" | "yellow" | "red"

export type GrowthInboxHubHealthItem = {
  id: string
  emoji: string
  label: string
  href: string
  status: GrowthInboxHubHealthStatus
}

export function buildGrowthInboxHubHealthItems(metrics: GrowthInboxOverviewMetrics): GrowthInboxHubHealthItem[] {
  const repliesHealthy = metrics.needsAction === 0 && metrics.unreadConversations === 0
  const meetingsNeedAttention = metrics.meetingIntent > 0 || metrics.meetingRequests > 0
  const highPriorityOverdue = metrics.highPriority > 0

  return [
    {
      id: "replies-healthy",
      emoji: "🟢",
      label: repliesHealthy ? "Replies healthy" : "Replies need review",
      href: growthWorkspaceInboxViewHref("needs_action"),
      status: repliesHealthy ? "green" : "yellow",
    },
    {
      id: "meetings-attention",
      emoji: "🟡",
      label: meetingsNeedAttention ? "Meetings need attention" : "Meetings on track",
      href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
      status: meetingsNeedAttention ? "yellow" : "green",
    },
    {
      id: "high-priority-overdue",
      emoji: "🔴",
      label: highPriorityOverdue ? "High-priority threads overdue" : "Priority queue clear",
      href: growthWorkspaceInboxViewHref("high_priority"),
      status: highPriorityOverdue ? "red" : "green",
    },
  ]
}
