/** GE-AIOS-LAUNCH-1D — Discovery mission work item detection (client-safe). */

import type { AvaWorkItem } from "@/lib/growth/work-manager/types"

export const GROWTH_ASL_DISCOVERY_MISSION_EXECUTION_LAUNCH_1D_QA_MARKER =
  "ge-aios-launch-1d-asl-discovery-mission-execution-v1" as const

const SALES_WORK_ITEM_TYPES = new Set([
  "research",
  "qualification",
  "outreach",
  "meeting",
  "reply",
  "approval",
])

export function resolveDiscoveryMissionSourceId(item: AvaWorkItem): string | null {
  const sourceId = item.decision_source_id?.trim() || item.id.replace(/^work:/, "").trim()
  return sourceId.startsWith("discovery:") ? sourceId : null
}

export function isDiscoveryMissionWorkItem(item: AvaWorkItem): boolean {
  return resolveDiscoveryMissionSourceId(item) != null
}

export function isSalesRoutedWorkItem(item: AvaWorkItem): boolean {
  return SALES_WORK_ITEM_TYPES.has(item.type) || isDiscoveryMissionWorkItem(item)
}
