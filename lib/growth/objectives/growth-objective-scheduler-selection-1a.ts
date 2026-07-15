/**
 * GE-AIOS-SCHEDULER-RUNTIME-OPTIMIZATION-1A — Deterministic scheduler objective/org selection.
 */

import {
  GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT,
  GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT,
} from "@/lib/growth/relationship/relationship-scale-limits"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { isObjectiveSchedulerBackoffElapsed } from "@/lib/growth/objectives/growth-objective-scheduler-retry-1a"

export const GROWTH_OBJECTIVE_SCHEDULER_SELECTION_1A_QA_MARKER =
  "ge-aios-scheduler-runtime-optimization-1a-selection-v1" as const

export function getObjectiveSchedulerWakeAt(objective: GrowthObjective): number {
  const wake =
    objective.runtime?.lastSchedulerAt ??
    objective.runtime?.lastTickAt ??
    objective.runtime?.startedAt ??
    null
  if (!wake) return 0
  const parsed = Date.parse(wake)
  return Number.isFinite(parsed) ? parsed : 0
}

export function sortObjectivesBySchedulerWakeTime(objectives: GrowthObjective[]): GrowthObjective[] {
  return [...objectives].sort((left, right) => {
    const leftWake = getObjectiveSchedulerWakeAt(left)
    const rightWake = getObjectiveSchedulerWakeAt(right)
    if (leftWake !== rightWake) return leftWake - rightWake
    return left.id.localeCompare(right.id)
  })
}

export function filterSchedulerEligibleObjectives(objectives: GrowthObjective[]): GrowthObjective[] {
  return objectives.filter(
    (entry) =>
      entry.status === "active" &&
      entry.runtime?.running === true &&
      !entry.emergencyStopActive &&
      entry.runtime?.stageStates?.[entry.runtime.currentStageId]?.state !== "paused" &&
      isObjectiveSchedulerBackoffElapsed(entry),
  )
}

export type SchedulerOrgFairnessBucket = {
  organizationId: string
  objectives: GrowthObjective[]
  oldestWakeAt: number
}

export function buildSchedulerOrgFairnessBuckets(
  objectives: GrowthObjective[],
): SchedulerOrgFairnessBucket[] {
  const eligible = filterSchedulerEligibleObjectives(objectives)
  const byOrg = new Map<string, GrowthObjective[]>()
  for (const objective of eligible) {
    const bucket = byOrg.get(objective.organizationId) ?? []
    bucket.push(objective)
    byOrg.set(objective.organizationId, bucket)
  }

  return [...byOrg.entries()]
    .map(([organizationId, orgObjectives]) => {
      const sorted = sortObjectivesBySchedulerWakeTime(orgObjectives)
      return {
        organizationId,
        objectives: sorted,
        oldestWakeAt: getObjectiveSchedulerWakeAt(sorted[0]!),
      }
    })
    .sort((left, right) => {
      if (left.oldestWakeAt !== right.oldestWakeAt) return left.oldestWakeAt - right.oldestWakeAt
      return left.organizationId.localeCompare(right.organizationId)
    })
}

export function selectSchedulerObjectivesWithOrgFairness(
  objectives: GrowthObjective[],
  input?: {
    maxObjectives?: number
    maxOrganizations?: number
  },
): {
  selected: GrowthObjective[]
  organizationsConsidered: number
  organizationsSelected: number
} {
  const maxObjectives = input?.maxObjectives ?? GROWTH_OBJECTIVE_SCHEDULER_EXECUTION_LIMIT
  const maxOrganizations = input?.maxOrganizations ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT
  const buckets = buildSchedulerOrgFairnessBuckets(objectives)
  const orgBuckets = buckets.slice(0, maxOrganizations)
  const perOrgCap = Math.max(1, Math.floor(maxObjectives / Math.max(1, orgBuckets.length)))

  const selected: GrowthObjective[] = []
  for (const bucket of orgBuckets) {
    selected.push(...bucket.objectives.slice(0, perOrgCap))
    if (selected.length >= maxObjectives) break
  }

  return {
    selected: sortObjectivesBySchedulerWakeTime(selected).slice(0, maxObjectives),
    organizationsConsidered: buckets.length,
    organizationsSelected: orgBuckets.length,
  }
}

export function selectSchedulerOrganizationIdsWithFairness(
  objectives: GrowthObjective[],
  input?: { limit?: number },
): string[] {
  const limit = input?.limit ?? GROWTH_OBJECTIVE_SCHEDULER_ORG_FETCH_LIMIT
  return buildSchedulerOrgFairnessBuckets(objectives)
    .slice(0, limit)
    .map((bucket) => bucket.organizationId)
}
