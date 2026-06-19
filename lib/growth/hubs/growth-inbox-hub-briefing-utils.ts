/** Today's Inbox Briefing helpers (UX-AUDIT-7). Client-safe. */

import type { GrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import {
  growthWorkspaceInboxViewHref,
  growthWorkspaceInboxWorkflowHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_INBOX_HUB_BRIEFING_QA_MARKER = "growth-inbox-hub-briefing-v1" as const

export function formatGrowthInboxTimeGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatGrowthInboxBriefingHeadline(operatorFirstName?: string | null): string {
  const greeting = formatGrowthInboxTimeGreeting()
  const name = operatorFirstName?.trim()
  return name ? `${greeting}, ${name}` : greeting
}

export function extractGrowthInboxOperatorFirstName(displayName?: string | null): string | null {
  const trimmed = displayName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export type GrowthInboxBriefingLine = {
  id: string
  text: string
  count: number
}

export function buildGrowthInboxBriefingLines(metrics: GrowthInboxOverviewMetrics): GrowthInboxBriefingLine[] {
  return buildGrowthInboxFinalPolishBriefingLines(metrics)
}

/** UX-AUDIT-9 — operator daily-driver hero copy. */
export function buildGrowthInboxFinalPolishBriefingLines(metrics: GrowthInboxOverviewMetrics): GrowthInboxBriefingLine[] {
  return [
    {
      id: "needs-replies",
      count: metrics.needsAction,
      text: `${metrics.needsAction.toLocaleString()} conversation${metrics.needsAction === 1 ? "" : "s"} need replies.`,
    },
    {
      id: "ready-to-call",
      count: metrics.highPriority,
      text: `${metrics.highPriority.toLocaleString()} prospect${metrics.highPriority === 1 ? "" : "s"} ${metrics.highPriority === 1 ? "is" : "are"} ready to call.`,
    },
    {
      id: "meeting-follow-up",
      count: metrics.meetingIntent,
      text: `${metrics.meetingIntent.toLocaleString()} meeting${metrics.meetingIntent === 1 ? "" : "s"} need${metrics.meetingIntent === 1 ? "s" : ""} follow-up.`,
    },
  ]
}

/** Priority: meetings → interested → high-priority threads → everything else. */
export function resolveGrowthInboxContinueWorkingHref(metrics: GrowthInboxOverviewMetrics): string {
  if (metrics.meetingIntent > 0) return GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF
  if (metrics.interested > 0) return growthWorkspaceInboxViewHref("interested")
  if (metrics.highPriority > 0) return growthWorkspaceInboxViewHref("high_priority")
  if (metrics.needsAction > 0) return growthWorkspaceInboxViewHref("needs_action")
  return growthWorkspaceInboxWorkflowHref()
}
