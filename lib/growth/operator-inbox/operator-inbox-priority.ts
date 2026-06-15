/** Phase GS-1E — Deterministic operator inbox prioritization (client-safe). */

import type {
  OperatorInboxItem,
  OperatorInboxPriority,
} from "@/lib/growth/operator-inbox/operator-inbox-types"

const PRIORITY_RANK: Record<OperatorInboxPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const SOURCE_BOOST: Record<OperatorInboxItem["source"], number> = {
  human_approval: 25,
  reply_workflow: 20,
  attention: 18,
  signal: 15,
  inbox_thread: 12,
  recommended_action: 10,
}

const STATUS_PENALTY: Record<OperatorInboxItem["status"], number> = {
  new: 0,
  viewed: -5,
  reviewed: -20,
  dismissed: -100,
}

export function scoreOperatorInboxItem(item: OperatorInboxItem): number {
  const priorityScore = PRIORITY_RANK[item.priority] * 25
  const confidenceScore = Math.min(25, Math.round(item.confidence * 0.25))
  const sourceBoost = SOURCE_BOOST[item.source] ?? 0
  const statusPenalty = STATUS_PENALTY[item.status] ?? 0
  const recencyMs = Date.now() - Date.parse(item.occurred_at)
  const recencyBoost =
    Number.isFinite(recencyMs) && recencyMs <= 3 * 60 * 60 * 1000
      ? Math.round(15 * (1 - recencyMs / (3 * 60 * 60 * 1000)))
      : 0

  return priorityScore + confidenceScore + sourceBoost + statusPenalty + recencyBoost
}

export function rankOperatorInboxItems(items: OperatorInboxItem[]): OperatorInboxItem[] {
  return [...items].sort((left, right) => {
    const scoreDiff = scoreOperatorInboxItem(right) - scoreOperatorInboxItem(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.occurred_at.localeCompare(left.occurred_at)
  })
}

export function filterOperatorInboxItems(
  items: OperatorInboxItem[],
  filter: import("@/lib/growth/operator-inbox/operator-inbox-types").OperatorInboxFilter,
): OperatorInboxItem[] {
  switch (filter) {
    case "urgent":
      return items.filter((item) => item.priority === "urgent" || item.priority === "high")
    case "signals":
      return items.filter((item) => item.source === "signal")
    case "replies":
      return items.filter((item) => item.source === "reply_workflow" || item.source === "inbox_thread")
    case "approvals":
      return items.filter((item) => item.source === "human_approval")
    case "attention":
      return items.filter((item) => item.source === "attention")
    case "threads":
      return items.filter((item) => item.source === "inbox_thread")
    default:
      return items.filter((item) => item.status !== "dismissed")
  }
}
