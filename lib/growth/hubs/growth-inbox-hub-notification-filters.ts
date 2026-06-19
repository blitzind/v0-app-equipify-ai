/** Operator notification filter UX mapping — merged into queue views (UX-AUDIT-9). */

import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import type { OperatorInboxFilter, OperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-types"

export const GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS = [
  { id: "needs_action", apiFilter: "attention", label: "Needs Action", queueView: "needs_action" },
  { id: "interested", apiFilter: "replies", label: "Interested", queueView: "interested" },
  { id: "meetings", apiFilter: "replies", label: "Meetings", queueView: "meeting_intent" },
  { id: "unread", apiFilter: "attention", label: "Unread", queueView: "unread" },
  { id: "approvals", apiFilter: "approvals", label: "Approvals", queueView: null },
  { id: "system_alerts", apiFilter: "signals", label: "System Alerts", queueView: null },
] as const

export type GrowthInboxNotificationOperatorFilterId =
  (typeof GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS)[number]["id"]

export function resolveGrowthInboxNotificationQueueView(
  displayFilter: GrowthInboxNotificationOperatorFilterId,
): GrowthInboxQueueView | null {
  return GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS.find((entry) => entry.id === displayFilter)?.queueView ?? null
}

export function resolveGrowthInboxNotificationApiFilter(
  displayFilter: GrowthInboxNotificationOperatorFilterId,
): OperatorInboxFilter {
  return (
    GROWTH_INBOX_NOTIFICATION_OPERATOR_FILTERS.find((entry) => entry.id === displayFilter)?.apiFilter ?? "all"
  )
}

export function refineGrowthInboxNotificationItems(
  items: OperatorInboxItem[],
  displayFilter: GrowthInboxNotificationOperatorFilterId,
): OperatorInboxItem[] {
  if (displayFilter === "interested") {
    return items.filter((item) => /interested|positive|referral|reply/i.test(`${item.title} ${item.description}`))
  }
  if (displayFilter === "meetings") {
    return items.filter((item) => /meeting|book|calendar|demo/i.test(`${item.title} ${item.description}`))
  }
  if (displayFilter === "unread") {
    return items.filter((item) => /unread|needs review|attention|reply/i.test(`${item.title} ${item.description}`))
  }
  return items
}
