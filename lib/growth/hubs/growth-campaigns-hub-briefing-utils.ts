/** Today's Campaign Briefing copy + routing helpers (UX-AUDIT-6). Client-safe. */

import type { GrowthCampaignsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-campaigns-hub-metrics-client"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
  GROWTH_CAMPAIGNS_HUB_HREF,
  GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_CAMPAIGNS_HUB_BRIEFING_QA_MARKER = "growth-campaigns-hub-briefing-v1" as const

export function formatGrowthCampaignsTimeGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatGrowthCampaignsBriefingHeadline(operatorFirstName?: string | null): string {
  const greeting = formatGrowthCampaignsTimeGreeting()
  const name = operatorFirstName?.trim()
  return name ? `${greeting}, ${name}` : greeting
}

export function extractGrowthCampaignsOperatorFirstName(displayName?: string | null): string | null {
  const trimmed = displayName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export type GrowthCampaignsBriefingLine = {
  id: string
  text: string
}

export function buildGrowthCampaignsBriefingLines(
  metrics: GrowthCampaignsHubMetricsSnapshot,
): GrowthCampaignsBriefingLine[] {
  const lines: GrowthCampaignsBriefingLine[] = []

  lines.push({
    id: "entered-today",
    text: `${metrics.prospectsEnteredToday.toLocaleString()} prospect${metrics.prospectsEnteredToday === 1 ? "" : "s"} entered campaigns today`,
  })
  lines.push({
    id: "need-follow-up",
    text: `${metrics.prospectsNeedFollowUp.toLocaleString()} prospect${metrics.prospectsNeedFollowUp === 1 ? "" : "s"} need follow-up`,
  })
  lines.push({
    id: "meetings-booked",
    text: `${metrics.meetingsBooked.toLocaleString()} meeting${metrics.meetingsBooked === 1 ? "" : "s"} booked`,
  })
  lines.push({
    id: "need-attention",
    text: `${metrics.campaignsNeedAttention.toLocaleString()} campaign${metrics.campaignsNeedAttention === 1 ? "" : "s"} need attention`,
  })

  return lines
}

/** Priority: overdue follow-ups → replies awaiting review → meetings → campaigns needing approval. */
export function resolveGrowthCampaignsContinueWorkingHref(metrics: GrowthCampaignsHubMetricsSnapshot): string {
  if (metrics.overdueFollowUps > 0) return `${GROWTH_CAMPAIGNS_HUB_HREF}#my-tasks`
  if (metrics.repliesAwaitingReview > 0) return `${GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}?focus=replies`
  if (metrics.meetingsBooked > 0) return GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF
  if (metrics.campaignsNeedAttention > 0) return `${GROWTH_CAMPAIGNS_HUB_HREF}#campaign-health`
  return GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF
}
