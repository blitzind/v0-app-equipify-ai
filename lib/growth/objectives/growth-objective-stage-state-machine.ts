/** GE-AUTO-2A — Objective runtime stage state machine (client-safe). */

import {
  GROWTH_OBJECTIVE_STAGE_IDS,
  type GrowthObjective,
  type GrowthObjectiveRuntimeStageRecord,
  type GrowthObjectiveRuntimeStageState,
  type GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"

const ALLOWED_TRANSITIONS: Record<
  GrowthObjectiveRuntimeStageState,
  readonly GrowthObjectiveRuntimeStageState[]
> = {
  pending: ["running"],
  running: ["completed", "blocked", "paused", "failed"],
  blocked: ["running"],
  paused: ["running"],
  completed: [],
  failed: [],
}

export function canTransitionObjectiveRuntimeStage(
  from: GrowthObjectiveRuntimeStageState,
  to: GrowthObjectiveRuntimeStageState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function buildInitialObjectiveRuntimeStageRecords(): Record<
  GrowthObjectiveStageId,
  GrowthObjectiveRuntimeStageRecord
> {
  const records = {} as Record<GrowthObjectiveStageId, GrowthObjectiveRuntimeStageRecord>
  for (const stageId of GROWTH_OBJECTIVE_STAGE_IDS) {
    records[stageId] = {
      state: "pending",
      startedAt: null,
      completedAt: null,
      lastError: null,
      progress: 0,
      blockers: [],
    }
  }
  return records
}

export function transitionObjectiveRuntimeStage(
  record: GrowthObjectiveRuntimeStageRecord,
  next: GrowthObjectiveRuntimeStageState,
  input?: { error?: string | null; blockers?: string[]; progress?: number },
): GrowthObjectiveRuntimeStageRecord {
  if (!canTransitionObjectiveRuntimeStage(record.state, next)) {
    throw new Error(`Invalid objective stage transition: ${record.state} → ${next}`)
  }
  const now = new Date().toISOString()
  return {
    ...record,
    state: next,
    startedAt: next === "running" ? record.startedAt ?? now : record.startedAt,
    completedAt: next === "completed" || next === "failed" ? now : record.completedAt,
    lastError: input?.error ?? (next === "failed" ? record.lastError : null),
    blockers: input?.blockers ?? record.blockers,
    progress:
      input?.progress ??
      (next === "completed" ? 100 : next === "running" ? Math.max(record.progress, 10) : record.progress),
  }
}

export function resolveNextObjectiveStageId(
  current: GrowthObjectiveStageId,
): GrowthObjectiveStageId | null {
  const index = GROWTH_OBJECTIVE_STAGE_IDS.indexOf(current)
  if (index < 0 || index >= GROWTH_OBJECTIVE_STAGE_IDS.length - 1) return null
  return GROWTH_OBJECTIVE_STAGE_IDS[index + 1] ?? null
}

export function computeObjectiveProgressPercent(input: {
  currentValue: number
  targetValue: number
  completedStages: number
  totalStages: number
}): number {
  const outcomeProgress =
    input.targetValue > 0 ? Math.min(100, Math.round((input.currentValue / input.targetValue) * 100)) : 0
  const stageProgress =
    input.totalStages > 0 ? Math.round((input.completedStages / input.totalStages) * 100) : 0
  return Math.round(outcomeProgress * 0.7 + stageProgress * 0.3)
}

export function computeObjectiveStageDurationMs(
  record: GrowthObjectiveRuntimeStageRecord | undefined,
): number | null {
  if (!record?.startedAt) return null
  const end = record.completedAt ? Date.parse(record.completedAt) : Date.now()
  const start = Date.parse(record.startedAt)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return Math.max(0, end - start)
}

export function isObjectiveRuntimeStalled(objective: GrowthObjective, thresholdMs = 45 * 60 * 1000): boolean {
  const lastActivity =
    objective.runtime?.lastTickAt ?? objective.runtime?.lastSignalAt ?? objective.runtime?.startedAt
  if (!lastActivity || !objective.runtime?.running) return false
  return Date.now() - Date.parse(lastActivity) >= thresholdMs
}

export function computeObjectiveDashboardProgress(objective: GrowthObjective): number {
  const completedStages = objective.runtime
    ? GROWTH_OBJECTIVE_STAGE_IDS.filter((id) => objective.runtime?.stageStates[id]?.state === "completed").length
    : 0
  return computeObjectiveProgressPercent({
    currentValue: objective.currentValue,
    targetValue: objective.targetValue,
    completedStages,
    totalStages: GROWTH_OBJECTIVE_STAGE_IDS.length,
  })
}
