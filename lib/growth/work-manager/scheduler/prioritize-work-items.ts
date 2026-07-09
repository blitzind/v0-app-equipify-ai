/** GE-AIOS-11A — Stable work ordering from decision scores (no duplicate scoring). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export function prioritizeWorkItems(items: AvaWorkItem[]): AvaWorkItem[] {
  return [...items].sort((left, right) => {
    if (right.decision_score !== left.decision_score) return right.decision_score - left.decision_score
    if (right.priority !== left.priority) return right.priority - left.priority
    return left.id.localeCompare(right.id)
  })
}

export function detectWorkInterruptions(
  items: AvaWorkItem[],
  activeWork: AvaWorkItem | null,
): Array<{ reply: AvaWorkItem; paused: AvaWorkItem | null }> {
  const replies = items.filter((item) => item.type === "reply")
  if (replies.length === 0) return []

  const topReply = replies[0]
  if (!topReply) return []

  if (!activeWork) {
    return [{ reply: topReply, paused: null }]
  }

  if (topReply.decision_score > activeWork.decision_score && activeWork.type !== "reply") {
    return [{ reply: topReply, paused: activeWork }]
  }

  return []
}
