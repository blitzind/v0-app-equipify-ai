/** GE-AIOS-11A — Ava Work Manager (canonical export). */

export {
  GROWTH_WORK_MANAGER_QA_MARKER,
  type AvaWorkItem,
  type AvaWorkItemStatus,
  type AvaWorkItemType,
  type AvaWorkItemSource,
  type AvaWorkInterruption,
  type AvaWorkManagerResult,
  type AvaWorkPlanEntry,
} from "@/lib/growth/work-manager/types"

export type { BuildWorkContextInput } from "@/lib/growth/work-manager/context/build-work-context"

export {
  nextBestActionToWorkItem,
  nextBestActionsToWorkItems,
  mapDecisionKindToWorkItemType,
} from "@/lib/growth/work-manager/bridges/decision-engine-bridge"

export {
  applyCanonicalAuthorityToWorkItem,
  applyCanonicalAuthorityToWorkItems,
  applyCanonicalAuthorityToNextBestAction,
  detectCanonicalAuthorityConflicts,
  GROWTH_WORK_MANAGER_CANONICAL_AUTHORITY_BRIDGE_1B_QA_MARKER,
} from "@/lib/growth/work-manager/bridges/canonical-authority-work-manager-bridge-1b"

export {
  resolveWorkItemStatus,
  applyWorkItemStatus,
  isExecutableWorkItem,
  isOperatorWorkItem,
} from "@/lib/growth/work-manager/state/work-item-state"

export { prioritizeWorkItems, detectWorkInterruptions } from "@/lib/growth/work-manager/scheduler/prioritize-work-items"

export {
  buildCompletedWorkItems,
  buildDailyWorkPlan,
} from "@/lib/growth/work-manager/planner/build-daily-work-plan"

export {
  mapWorkItemTypeToStoryKind,
  mapWorkPlanToStoryPriority,
  buildTodayPrioritiesFromWorkPlan,
  buildWorkManagerStoryBlocks,
  buildWorkManagerNarrativeLines,
  buildWorkManagerSummary,
} from "@/lib/growth/work-manager/bridges/narrative-bridge"

export {
  runWorkManager,
  executeReadyWorkItems,
  type RunWorkManagerInput,
  type ExecuteReadyWorkItemsResult,
} from "@/lib/growth/work-manager/manager/run-work-manager"

export const AVA_WORK_MANAGER_TODAY_WORK_TITLE = "Today's Work" as const
export const AVA_WORK_MANAGER_WORKING_NOW_TITLE = "Working now" as const
export const AVA_WORK_MANAGER_UP_NEXT_TITLE = "Up next" as const
export const AVA_WORK_MANAGER_BLOCKED_TITLE = "Blocked" as const
export const AVA_WORK_MANAGER_WAITING_ON_YOU_TITLE = "Waiting on you" as const
export const AVA_WORK_MANAGER_COMPLETED_TODAY_TITLE = "Completed today" as const

export { buildPrimaryDecisionFromWorkManager } from "@/lib/growth/work-manager/home/build-primary-decision-work"
