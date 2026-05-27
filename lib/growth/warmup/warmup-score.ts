/** Deterministic warmup score from profile health signals. Client-safe. */

import type { GrowthWarmupHealthTier, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"

export type WarmupScoreInput = {
  status: GrowthWarmupProfileStatus
  health_warning?: boolean
  has_critical_event?: boolean
  progress_stalled?: boolean
  volume_behind_plan?: boolean
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeWarmupScore(input: WarmupScoreInput): number {
  let score = 100

  if (input.status === "paused") score -= 20
  if (input.health_warning) score -= 10
  if (input.has_critical_event) score -= 25
  if (input.progress_stalled) score -= 20
  if (input.volume_behind_plan) score -= 15

  return clampScore(score)
}

export function warmupScoreToTier(score: number): GrowthWarmupHealthTier {
  if (score >= 90) return "healthy"
  if (score >= 70) return "warning"
  if (score >= 40) return "degraded"
  return "critical"
}
