/** GE-AUTO-2B/2C/2D — Lightweight objective runtime scheduler (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { generateGrowthObjectiveAdaptiveRecommendations } from "@/lib/growth/objectives/growth-objective-adaptive-engine"
import {
  listActiveRunningGrowthObjectives,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import {
  autoContinueGrowthObjectiveRuntime,
  retryGrowthObjectiveStage,
  tickGrowthObjectiveRuntime,
} from "@/lib/growth/objectives/growth-objective-runtime-service"
import { buildObjectiveSignalSnapshot } from "@/lib/growth/objectives/growth-objective-signal-handler"
import {
  GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
  type GrowthObjective,
  type GrowthObjectiveSchedulerLastResult,
} from "@/lib/growth/objectives/growth-objective-types"

const STALL_THRESHOLD_MS = 45 * 60 * 1000
const MAX_OBJECTIVES_PER_TICK = 50
const MAX_ORGS_PER_TICK = 20
const MAX_SCHEDULER_RUNTIME_MS = 45_000

function isObjectiveStalled(objective: GrowthObjective, now = Date.now()): boolean {
  const lastActivity = objective.runtime?.lastTickAt ?? objective.runtime?.lastSignalAt ?? objective.runtime?.startedAt
  if (!lastActivity) return false
  const elapsed = now - Date.parse(lastActivity)
  return elapsed >= STALL_THRESHOLD_MS
}

function selectSchedulerObjectives(objectives: GrowthObjective[]): GrowthObjective[] {
  const eligible = objectives.filter(
    (entry) =>
      entry.status === "active" &&
      entry.runtime?.running &&
      !entry.emergencyStopActive,
  )

  const byOrg = new Map<string, GrowthObjective[]>()
  for (const objective of eligible) {
    const bucket = byOrg.get(objective.organizationId) ?? []
    bucket.push(objective)
    byOrg.set(objective.organizationId, bucket)
  }

  const orgIds = [...byOrg.keys()].slice(0, MAX_ORGS_PER_TICK)
  const selected: GrowthObjective[] = []

  for (const orgId of orgIds) {
    const orgObjectives = byOrg.get(orgId) ?? []
    selected.push(...orgObjectives.slice(0, Math.max(1, Math.floor(MAX_OBJECTIVES_PER_TICK / orgIds.length))))
    if (selected.length >= MAX_OBJECTIVES_PER_TICK) break
  }

  return selected.slice(0, MAX_OBJECTIVES_PER_TICK)
}

async function persistObjectiveSchedulerTouch(
  admin: SupabaseClient,
  objective: GrowthObjective,
  input: {
    stalled: boolean
    retried: boolean
    ticked: boolean
    failed: boolean
  },
): Promise<void> {
  if (!objective.runtime) return
  const now = new Date().toISOString()
  const lastSchedulerResult: GrowthObjectiveSchedulerLastResult = {
    ticksAttempted: input.ticked ? 1 : 0,
    retriesAttempted: input.retried ? 1 : 0,
    stalledDetected: input.stalled,
    failed: input.failed,
    at: now,
  }

  await updateGrowthObjective(admin, objective.organizationId, objective.id, {
    runtime: {
      ...objective.runtime,
      lastSchedulerAt: now,
      schedulerRunCount: (objective.runtime.schedulerRunCount ?? 0) + 1,
      schedulerRetryAttempts:
        (objective.runtime.schedulerRetryAttempts ?? 0) + (input.retried ? 1 : 0),
      stalledSince:
        input.stalled && !objective.runtime.stalledSince
          ? now
          : !input.stalled
            ? null
            : objective.runtime.stalledSince ?? null,
      lastSchedulerResult,
    },
  }).catch(() => undefined)
}

export type GrowthObjectiveRuntimeSchedulerResult = {
  qa_marker: typeof GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER
  objectivesScanned: number
  objectivesSelected: number
  ticksAttempted: number
  retriesAttempted: number
  stalledDetected: number
  recommendationsRefreshed: number
  failures: number
  skippedReason: string | null
}

export async function runGrowthObjectiveRuntimeScheduler(
  admin: SupabaseClient,
  input?: { certificationMode?: boolean },
): Promise<GrowthObjectiveRuntimeSchedulerResult> {
  const startedAt = Date.now()
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled || !killSwitches.autonomy_objective_mode_enabled) {
    return {
      qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
      objectivesScanned: 0,
      objectivesSelected: 0,
      ticksAttempted: 0,
      retriesAttempted: 0,
      stalledDetected: 0,
      recommendationsRefreshed: 0,
      failures: 0,
      skippedReason: "Objective runtime scheduler disabled by kill switch.",
    }
  }

  const allObjectives = await listActiveRunningGrowthObjectives(admin)
  const objectives = selectSchedulerObjectives(allObjectives)
  let ticksAttempted = 0
  let retriesAttempted = 0
  let stalledDetected = 0
  let recommendationsRefreshed = 0
  let failures = 0

  for (const objective of objectives) {
    if (Date.now() - startedAt >= MAX_SCHEDULER_RUNTIME_MS) break

    let retried = false
    let ticked = false
    let failed = false

    try {
      const stageId = objective.runtime?.currentStageId
      const stageState = stageId ? objective.runtime?.stageStates[stageId] : null
      const stalled = isObjectiveStalled(objective)
      if (stalled) stalledDetected += 1

      const snapshot = buildObjectiveSignalSnapshot(objective.recentSignals ?? [])
      const recommendations = generateGrowthObjectiveAdaptiveRecommendations({ objective, signals: snapshot })
      if (recommendations.length > 0) recommendationsRefreshed += 1

      if (stageState?.state === "blocked") {
        await retryGrowthObjectiveStage(admin, objective.organizationId, objective.id, input)
        retriesAttempted += 1
        retried = true
      } else if (stalled || stageState?.state === "pending" || stageState?.state === "running") {
        await tickGrowthObjectiveRuntime(admin, objective.organizationId, objective.id, input)
        ticksAttempted += 1
        ticked = true
        await autoContinueGrowthObjectiveRuntime(admin, objective.organizationId, objective.id, input)
      }

      await persistObjectiveSchedulerTouch(admin, objective, {
        stalled,
        retried,
        ticked,
        failed: false,
      })
    } catch {
      failures += 1
      failed = true
      await persistObjectiveSchedulerTouch(admin, objective, {
        stalled: isObjectiveStalled(objective),
        retried,
        ticked,
        failed: true,
      })
    }
  }

  logGrowthEngine("growth_objective_runtime_scheduler", {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
    objectives_scanned: allObjectives.length,
    objectives_selected: objectives.length,
    ticks_attempted: ticksAttempted,
    retries_attempted: retriesAttempted,
    stalled_detected: stalledDetected,
    failures,
    runtime_ms: Date.now() - startedAt,
  })

  return {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
    objectivesScanned: allObjectives.length,
    objectivesSelected: objectives.length,
    ticksAttempted,
    retriesAttempted,
    stalledDetected,
    recommendationsRefreshed,
    failures,
    skippedReason: null,
  }
}

export const GrowthObjectiveRuntimeScheduler = {
  runGrowthObjectiveRuntimeScheduler,
  MAX_OBJECTIVES_PER_TICK,
  MAX_ORGS_PER_TICK,
  MAX_SCHEDULER_RUNTIME_MS,
} as const
