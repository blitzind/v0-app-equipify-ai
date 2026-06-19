/** Operator health strip — derived from existing metrics only (UX-AUDIT-5). Client-safe. */

import type { GrowthLeadsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-leads-hub-metrics-client"

export const GROWTH_LEADS_HUB_OPERATOR_HEALTH_QA_MARKER = "growth-leads-hub-operator-health-v1" as const

export type GrowthLeadsOperatorHealthStatus = "green" | "yellow" | "red"

export type GrowthLeadsOperatorHealthItem = {
  id: string
  label: string
  status: GrowthLeadsOperatorHealthStatus
  emoji: string
}

function researchQueueStatus(count: number | null): GrowthLeadsOperatorHealthStatus {
  const value = count ?? 0
  if (value < 10) return "green"
  if (value <= 25) return "yellow"
  return "red"
}

function callQueueStatus(count: number | null): GrowthLeadsOperatorHealthStatus {
  const value = count ?? 0
  if (value < 5) return "green"
  if (value <= 15) return "yellow"
  return "red"
}

function followUpsStatus(count: number | null): GrowthLeadsOperatorHealthStatus {
  const value = count ?? 0
  if (value === 0) return "green"
  if (value <= 5) return "yellow"
  return "red"
}

const STATUS_EMOJI: Record<GrowthLeadsOperatorHealthStatus, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
}

const STATUS_LABEL: Record<GrowthLeadsOperatorHealthStatus, string> = {
  green: "Healthy",
  yellow: "Busy",
  red: "Overdue",
}

export function buildGrowthLeadsOperatorHealthItems(
  metrics: GrowthLeadsHubMetricsSnapshot,
): GrowthLeadsOperatorHealthItem[] {
  const research = researchQueueStatus(metrics.leadsAwaitingResearch)
  const calls = callQueueStatus(metrics.readyToCall)
  const followUps = followUpsStatus(metrics.followUpsOverdue)

  return [
    {
      id: "research-queue",
      label: `Research Queue ${STATUS_LABEL[research]}`,
      status: research,
      emoji: STATUS_EMOJI[research],
    },
    {
      id: "call-queue",
      label: `Call Queue ${STATUS_LABEL[calls]}`,
      status: calls,
      emoji: STATUS_EMOJI[calls],
    },
    {
      id: "follow-ups",
      label: `Follow-Ups ${STATUS_LABEL[followUps]}`,
      status: followUps,
      emoji: STATUS_EMOJI[followUps],
    },
  ]
}
