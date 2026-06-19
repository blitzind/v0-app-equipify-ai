import type { GrowthCampaignsHubMetricsSnapshot } from "@/lib/growth/hubs/growth-campaigns-hub-metrics-client"
import { GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthSequenceChannelTaskStatus } from "@/lib/growth/multichannel/multichannel-types"

export type GrowthCampaignsHubActiveCampaignRow = {
  id: string
  name: string
  status: GrowthSequenceChannelTaskStatus | "active" | "paused"
  leads: number
  replies: number
  meetings: number
  lastActivity: string | null
  href: string
}

function worstStatus(tasks: GrowthCampaignsHubMetricsSnapshot["taskQueue"]): GrowthCampaignsHubActiveCampaignRow["status"] {
  if (tasks.some((task) => task.status === "failed" || task.status === "blocked")) return "failed"
  if (tasks.some((task) => task.status === "pending")) return "pending"
  if (tasks.some((task) => task.status === "in_progress")) return "in_progress"
  if (tasks.some((task) => task.status === "approved")) return "approved"
  return "active"
}

export function buildGrowthCampaignsHubActiveCampaignRows(
  metrics: GrowthCampaignsHubMetricsSnapshot,
): GrowthCampaignsHubActiveCampaignRow[] {
  const grouped = new Map<string, GrowthCampaignsHubMetricsSnapshot["taskQueue"]>()

  for (const task of metrics.taskQueue) {
    const key = task.sequenceEnrollmentId
    const existing = grouped.get(key) ?? []
    existing.push(task)
    grouped.set(key, existing)
  }

  const rows = [...grouped.entries()].map(([enrollmentId, tasks]) => {
    const leadIds = new Set(tasks.map((task) => task.leadId))
    const replies = tasks.filter((task) => task.channel === "manual_followup" || task.channel === "email").length
    const meetings = tasks.filter((task) => task.channel === "booking_followup").length
    const lastActivity = tasks.reduce<string | null>((latest, task) => {
      const candidate = task.updatedAt || task.createdAt
      if (!latest) return candidate
      return new Date(candidate).getTime() > new Date(latest).getTime() ? candidate : latest
    }, null)

    return {
      id: enrollmentId,
      name: tasks[0]?.leadLabel ? `${tasks[0].leadLabel} sequence` : `Enrollment ${enrollmentId.slice(0, 8)}…`,
      status: worstStatus(tasks),
      leads: leadIds.size,
      replies,
      meetings,
      lastActivity,
      href: `${GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF}?enrollmentId=${encodeURIComponent(enrollmentId)}`,
    }
  })

  if (rows.length > 0) {
    return rows
      .sort((a, b) => {
        const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0
        const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 12)
  }

  return metrics.routingRules
    .filter((rule) => rule.isActive && !rule.isFuturePlaceholder)
    .slice(0, 6)
    .map((rule) => ({
      id: rule.id,
      name: rule.label,
      status: "active" as const,
      leads: 0,
      replies: 0,
      meetings: 0,
      lastActivity: rule.updatedAt,
      href: GROWTH_CAMPAIGNS_HUB_SEQUENCES_HREF,
    }))
}

export function formatGrowthCampaignsRelativeTime(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const deltaMs = Date.now() - date.getTime()
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
