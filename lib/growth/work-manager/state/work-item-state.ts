/** GE-AIOS-11A — Canonical work item lifecycle state resolution. */

import type { AvaWorkItem, AvaWorkItemStatus } from "@/lib/growth/work-manager/types"

export function resolveWorkItemStatus(
  item: AvaWorkItem,
  options: { isActive?: boolean; forceOperatorWait?: boolean } = {},
): AvaWorkItemStatus {
  if (item.status === "completed" || item.status === "cancelled") return item.status

  if (item.requires_operator || options.forceOperatorWait) {
    return "waiting_for_operator"
  }
  if (item.blocked_by.length > 0) {
    return "blocked"
  }
  if (options.isActive && item.can_execute_autonomously) {
    return "working"
  }
  if (item.can_execute_autonomously) {
    return "ready"
  }
  if (item.type === "wait") {
    return "deferred"
  }
  return "planned"
}

export function applyWorkItemStatus(item: AvaWorkItem, status: AvaWorkItemStatus): AvaWorkItem {
  return { ...item, status, updated_at: new Date().toISOString() }
}

export function isExecutableWorkItem(item: AvaWorkItem): boolean {
  return item.can_execute_autonomously && item.status !== "blocked" && item.status !== "waiting_for_operator"
}

export function isOperatorWorkItem(item: AvaWorkItem): boolean {
  return item.requires_operator || item.type === "approval" || item.type === "reply"
}
