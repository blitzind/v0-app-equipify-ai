/** GE-AIOS-13A — Map Work Manager items to operating phases (no work ownership). */

import type { AvaWorkItem, AvaWorkItemType } from "@/lib/growth/work-manager/types"
import type { AvaOperatingPhaseId } from "@/lib/growth/operating-rhythm/types"
import type { AvaWorkManagerResult } from "@/lib/growth/work-manager/types"

const WORK_TYPE_TO_PHASE: Record<AvaWorkItemType, AvaOperatingPhaseId> = {
  research: "research_cycle",
  qualification: "qualification_cycle",
  outreach: "outreach_preparation",
  approval: "approval_collection",
  reply: "inbox_monitoring",
  meeting: "outreach_preparation",
  mission: "morning_planning",
  business_understanding: "research_cycle",
  wait: "reflection",
}

export function mapWorkItemTypeToOperatingPhase(type: AvaWorkItemType): AvaOperatingPhaseId {
  return WORK_TYPE_TO_PHASE[type] ?? "morning_planning"
}

export function resolveCurrentPhaseFromWorkManager(
  workResult: AvaWorkManagerResult,
  hour: number,
): AvaOperatingPhaseId {
  if (workResult.active_work) {
    return mapWorkItemTypeToOperatingPhase(workResult.active_work.type)
  }
  if (workResult.interruptions.length > 0) {
    return "inbox_monitoring"
  }
  if (workResult.operator_queue.length > 0) {
    return "approval_collection"
  }
  if (hour >= 17) return "reflection"
  if (hour >= 12) return "outreach_preparation"
  if (hour >= 9) return "research_cycle"
  return "morning_planning"
}

export function buildTodayPlanFromWorkManager(workResult: AvaWorkManagerResult): string[] {
  return workResult.work_plan.slice(0, 5).map((entry) => entry.title.replace(/\.$/, ""))
}

export function groupWorkItemsByPhase(workResult: AvaWorkManagerResult): Record<AvaOperatingPhaseId, AvaWorkItem[]> {
  const groups = {} as Record<AvaOperatingPhaseId, AvaWorkItem[]>
  for (const item of workResult.all_work_items) {
    const phase = mapWorkItemTypeToOperatingPhase(item.type)
    groups[phase] = [...(groups[phase] ?? []), item]
  }
  return groups
}
