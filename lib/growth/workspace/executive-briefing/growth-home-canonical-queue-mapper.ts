/** GE-AIOS-UX-1B — Map canonical daily revenue work queue into home presentation (client-safe). */

import type { DailyRevenueWorkQueue } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { DailyRevenueWorkQueueDisplaySummary } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-view"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type {
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

function confidencePresentation(score: number | null): {
  confidencePercent: number | null
  confidenceLabel: string | null
} {
  if (score == null || !Number.isFinite(score) || score <= 0) {
    return { confidencePercent: null, confidenceLabel: null }
  }
  const percent = Math.round(Math.max(0, Math.min(100, score)))
  if (percent >= 85) return { confidencePercent: percent, confidenceLabel: "High Confidence" }
  if (percent >= 70) return { confidencePercent: percent, confidenceLabel: "Medium Confidence" }
  return { confidencePercent: percent, confidenceLabel: "Requires Review" }
}

function mapPriority(priority: string): GrowthHomeDailyWorkQueueItem["priority"] {
  if (priority === "critical") return "critical"
  if (priority === "high") return "high"
  if (priority === "low") return "low"
  return "medium"
}

function leadHref(leadId: string): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/${encodeURIComponent(leadId)}`
}

export function hasCanonicalDailyWorkQueue(input: {
  enabled?: boolean
  dailyRevenueWorkQueueEnabled?: boolean
  queue?: DailyRevenueWorkQueue | null
  dailyRevenueWorkQueue?: DailyRevenueWorkQueue | null
  display?: DailyRevenueWorkQueueDisplaySummary | null
  dailyRevenueWorkQueueDisplay?: DailyRevenueWorkQueueDisplaySummary | null
}): boolean {
  const isEnabled = input.dailyRevenueWorkQueueEnabled === true || input.enabled === true
  const queue = input.dailyRevenueWorkQueue ?? input.queue ?? null
  const display = input.dailyRevenueWorkQueueDisplay ?? input.display ?? null
  return isEnabled && Boolean(queue && display)
}

export function mapCanonicalQueueDisplayToHomeItems(
  display: DailyRevenueWorkQueueDisplaySummary,
): GrowthHomeDailyWorkQueueItem[] {
  return display.top_items.slice(0, 6).map((item) => ({
    id: item.lead_id,
    priority: mapPriority(item.priority),
    companyName: item.company_name?.trim() || "Account",
    actionLabel: item.action_label,
    channelLabel: item.channel_label,
    reason: item.reasoning,
    estimatedMinutes: item.estimated_minutes,
    requiresHumanApproval: item.requires_human_approval,
    href: leadHref(item.lead_id),
    ...confidencePresentation(item.confidence),
  }))
}

export function mapCanonicalQueueToWaitingOnYou(
  queue: DailyRevenueWorkQueue,
  display: DailyRevenueWorkQueueDisplaySummary,
): GrowthHomeWaitingOnYouItem[] {
  const items: GrowthHomeWaitingOnYouItem[] = []
  const namesByLeadId = Object.fromEntries(
    display.top_items.map((item) => [item.lead_id, item.company_name ?? "Account"]),
  )

  const push = (id: string, label: string, detail: string, href: string) => {
    if (!items.some((item) => item.id === id)) {
      items.push({ id, label, detail, href })
    }
  }

  for (const item of queue.blocked) {
    push(
      `queue-blocked-${item.taskKey}`,
      `${namesByLeadId[item.leadId] ?? "Account"} blocked`,
      item.reasoning[0] ?? "Blocked from continuing until you review.",
      leadHref(item.leadId),
    )
  }

  for (const item of queue.waiting) {
    push(
      `queue-waiting-${item.taskKey}`,
      `${namesByLeadId[item.leadId] ?? "Account"} waiting`,
      item.reasoning[0] ?? "Waiting on operator input before I can continue.",
      leadHref(item.leadId),
    )
  }

  for (const item of [...queue.critical, ...queue.high, ...queue.medium, ...queue.low]) {
    if (!item.requiresHumanApproval && item.action !== "request_human_review") continue
    push(
      `queue-approval-${item.taskKey}`,
      `Approve ${namesByLeadId[item.leadId] ?? "account"} ${item.action.replace(/_/g, " ")}`,
      item.reasoning[0] ?? "Human approval required before I can continue.",
      leadHref(item.leadId),
    )
  }

  return items.slice(0, 8)
}

export function pickTopCanonicalQueueActionItem(
  queue: DailyRevenueWorkQueue,
  display: DailyRevenueWorkQueueDisplaySummary,
) {
  const topLeadId =
    queue.critical[0]?.leadId ??
    queue.high[0]?.leadId ??
    queue.medium[0]?.leadId ??
    queue.low[0]?.leadId ??
    null
  if (!topLeadId) return null

  const topItem = display.top_items.find((item) => item.lead_id === topLeadId) ?? display.top_items[0]
  if (!topItem) return null

  return {
    leadId: topItem.lead_id,
    companyName: topItem.company_name?.trim() || "Account",
    actionLabel: topItem.action_label,
    channelLabel: topItem.channel_label,
    reasoning: topItem.reasoning,
    href: leadHref(topItem.lead_id),
    requiresHumanApproval: topItem.requires_human_approval,
  }
}
