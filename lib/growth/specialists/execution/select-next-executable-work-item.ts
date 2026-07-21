/** GE-AIOS-18A — Select highest-value executable work item (client-safe). */

import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"
import type { AvaWorkItem, AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

export function selectNextExecutableWorkItem(
  workResult: AvaWorkManagerResult,
  options?: { excludeWorkItemIds?: ReadonlySet<string> },
): AvaWorkItem | null {
  const exclude = options?.excludeWorkItemIds
  const candidates: AvaWorkItem[] = []
  if (workResult.active_work && isExecutableWorkItem(workResult.active_work)) {
    if (!exclude?.has(workResult.active_work.id)) {
      candidates.push(workResult.active_work)
    }
  }

  for (const entry of workResult.work_plan) {
    const item = workResult.all_work_items.find((row) => row.id === entry.work_item_id)
    if (!item || item.id === workResult.active_work?.id) continue
    if (exclude?.has(item.id)) continue
    if (isExecutableWorkItem(item) && (item.status === "ready" || item.status === "working")) {
      candidates.push(item)
    }
  }

  return (
    candidates.sort((left, right) => {
      if (right.decision_score !== left.decision_score) {
        return right.decision_score - left.decision_score
      }
      return right.priority - left.priority
    })[0] ?? null
  )
}
