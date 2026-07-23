/** GE-AIOS-11A — Stable work ordering from decision scores (no duplicate scoring). */

import { applyMissionBalanceToWorkItems } from "@/lib/growth/mission-balance/growth-mission-balance-1a"
import type { GrowthLead } from "@/lib/growth/types"
import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export type PrioritizeWorkItemsOptions = {
  leadsById?: ReadonlyMap<string, GrowthLead>
  generatedAt?: string
  organizationId?: string | null
}

function sortByDecisionScore(items: AvaWorkItem[]): AvaWorkItem[] {
  return [...items].sort((left, right) => {
    if (right.decision_score !== left.decision_score) return right.decision_score - left.decision_score
    if (right.priority !== left.priority) return right.priority - left.priority
    return left.id.localeCompare(right.id)
  })
}

export function prioritizeWorkItems(
  items: AvaWorkItem[],
  options?: PrioritizeWorkItemsOptions,
): AvaWorkItem[] {
  const baseSorted = sortByDecisionScore(items)
  if (!options?.leadsById || options.leadsById.size === 0) return baseSorted
  return applyMissionBalanceToWorkItems(baseSorted, options.leadsById, {
    generatedAt: options.generatedAt,
    organizationId: options.organizationId ?? undefined,
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
