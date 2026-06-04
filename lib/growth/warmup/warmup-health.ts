/** Warmup health + progress evaluation. Client-safe. */

import { computeWarmupScore, warmupScoreToTier } from "@/lib/growth/warmup/warmup-score"
import type { WarmupScheduleDayDraft } from "@/lib/growth/warmup/warmup-scheduler"
import { getPlannedVolumeForDay } from "@/lib/growth/warmup/warmup-scheduler"
import type {
  GrowthWarmupHealthTier,
  GrowthWarmupProfileStatus,
} from "@/lib/growth/warmup/warmup-types"

const PROGRESS_STALL_MS = 3 * 24 * 60 * 60 * 1000

export type WarmupHealthEvaluationInput = {
  status: GrowthWarmupProfileStatus
  warmup_days: number
  warmup_progress: number
  current_daily_volume: number
  current_day_number: number
  schedule: WarmupScheduleDayDraft[]
  last_progress_at: string | null
  has_critical_event?: boolean
  now?: Date
}

export type WarmupHealthEvaluation = {
  warmup_score: number
  warmup_health: GrowthWarmupHealthTier
  progress_stalled: boolean
  volume_behind_plan: boolean
}

export function computeCurrentWarmupDay(startedAt: string | null, now = new Date()): number {
  if (!startedAt) return 1
  const started = new Date(startedAt)
  if (Number.isNaN(started.getTime())) return 1
  const elapsedMs = Math.max(0, now.getTime() - started.getTime())
  return Math.max(1, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1)
}

export function computeWarmupProgress(input: {
  status: GrowthWarmupProfileStatus
  warmup_days: number
  completed_days: number
  current_day_number: number
}): number {
  if (input.status === "active") return 100
  const totalDays = Math.max(1, input.warmup_days)
  const progressDay = Math.min(totalDays, Math.max(input.completed_days, input.current_day_number - 1))
  return Math.max(0, Math.min(100, Math.round((progressDay / totalDays) * 100)))
}

export function isWarmupProgressStalled(lastProgressAt: string | null, status: GrowthWarmupProfileStatus, now = new Date()): boolean {
  if (status !== "warming") return false
  if (!lastProgressAt) return false
  const last = new Date(lastProgressAt)
  if (Number.isNaN(last.getTime())) return false
  return now.getTime() - last.getTime() > PROGRESS_STALL_MS
}

export function isWarmupVolumeBehindPlan(input: {
  status: GrowthWarmupProfileStatus
  current_daily_volume: number
  current_day_number: number
  schedule: WarmupScheduleDayDraft[]
}): boolean {
  if (input.status !== "warming") return false
  const planned = getPlannedVolumeForDay(input.schedule, input.current_day_number)
  return input.current_daily_volume < planned
}

export function evaluateWarmupHealth(input: WarmupHealthEvaluationInput): WarmupHealthEvaluation {
  const progress_stalled = isWarmupProgressStalled(input.last_progress_at, input.status, input.now)
  const volume_behind_plan = isWarmupVolumeBehindPlan({
    status: input.status,
    current_daily_volume: input.current_daily_volume,
    current_day_number: input.current_day_number,
    schedule: input.schedule,
  })

  const warmup_score = computeWarmupScore({
    status: input.status,
    health_warning: progress_stalled || volume_behind_plan,
    has_critical_event: input.has_critical_event,
    progress_stalled,
    volume_behind_plan,
  })

  const warmup_health = warmupScoreToTier(warmup_score)

  return {
    warmup_score,
    warmup_health,
    progress_stalled,
    volume_behind_plan,
  }
}

export function warmupHealthTierLabel(tier: GrowthWarmupHealthTier): string {
  switch (tier) {
    case "healthy":
      return "Healthy"
    case "warning":
      return "Warning"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
  }
}

export function detectProgressMilestone(previousProgress: number, nextProgress: number): number | null {
  for (const milestone of [25, 50, 75, 100]) {
    if (previousProgress < milestone && nextProgress >= milestone) return milestone
  }
  return null
}
