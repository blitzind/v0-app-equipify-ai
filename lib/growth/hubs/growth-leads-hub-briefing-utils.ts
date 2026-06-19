/** Today's Briefing copy + routing helpers (UX-AUDIT-5). Client-safe. */

import type { GrowthLeadsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-leads-hub-metrics-client"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_LEADS_HUB_BRIEFING_QA_MARKER = "growth-leads-hub-briefing-v1" as const

export function formatGrowthLeadsTimeGreeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatGrowthLeadsBriefingHeadline(operatorFirstName?: string | null): string {
  const greeting = formatGrowthLeadsTimeGreeting()
  const name = operatorFirstName?.trim()
  return name ? `${greeting}, ${name}` : greeting
}

export function extractGrowthLeadsOperatorFirstName(displayName?: string | null): string | null {
  const trimmed = displayName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0] ?? null
}

export type GrowthLeadsBriefingLine = {
  id: string
  text: string
}

export function buildGrowthLeadsBriefingLines(metrics: GrowthLeadsHubMetricsSnapshot): GrowthLeadsBriefingLine[] {
  const lines: GrowthLeadsBriefingLine[] = []

  const research = metrics.leadsAwaitingResearch
  if (research != null && research > 0) {
    lines.push({
      id: "research",
      text: `${research.toLocaleString()} lead${research === 1 ? "" : "s"} need research`,
    })
  }

  const ready = metrics.readyToCall
  if (ready != null && ready > 0) {
    lines.push({
      id: "ready",
      text: `${ready.toLocaleString()} lead${ready === 1 ? "" : "s"} ${ready === 1 ? "is" : "are"} ready to call`,
    })
  }

  const overdue = metrics.followUpsOverdue
  if (overdue != null && overdue > 0) {
    lines.push({
      id: "overdue",
      text: `${overdue.toLocaleString()} follow-up${overdue === 1 ? "" : "s"} ${overdue === 1 ? "is" : "are"} overdue`,
    })
  }

  if (lines.length === 0) {
    lines.push({ id: "clear", text: "Your queues look clear — great time to prospect new accounts." })
  }

  return lines
}

export function resolveGrowthLeadsContinueWorkingHref(metrics: GrowthLeadsHubMetricsSnapshot): string {
  const BASE = GROWTH_WORKSPACE_BASE_PATH
  if ((metrics.followUpsOverdue ?? 0) > 0) return `${BASE}/leads/queue`
  if ((metrics.readyToCall ?? 0) > 0) return `${BASE}/leads/queue`
  if ((metrics.leadsAwaitingResearch ?? 0) > 0) return `${BASE}/leads/research`
  if ((metrics.meetingsScheduled ?? 0) > 0) return `${BASE}/meetings`
  return `${BASE}/leads/research`
}
