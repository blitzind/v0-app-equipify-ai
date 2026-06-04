/** Warmup dashboard aggregation. Client-safe. */

import {
  GROWTH_WARMUP_FOUNDATION_QA_MARKER,
  type GrowthWarmupDashboard,
  type GrowthWarmupProfile,
} from "@/lib/growth/warmup/warmup-types"

export function buildWarmupDashboard(profiles: GrowthWarmupProfile[]): GrowthWarmupDashboard {
  const healthy_count = profiles.filter((profile) => profile.warmup_health === "healthy").length
  const paused_count = profiles.filter((profile) => profile.status === "paused").length
  const active_count = profiles.filter((profile) => profile.status === "active").length
  const warming_count = profiles.filter((profile) => profile.status === "warming").length
  const new_count = profiles.filter((profile) => profile.status === "new").length
  const throttled_count = profiles.filter((profile) => profile.status === "throttled").length

  const average_warmup_score =
    profiles.length > 0
      ? Math.round(profiles.reduce((sum, profile) => sum + profile.warmup_score, 0) / profiles.length)
      : 0

  return {
    qa_marker: GROWTH_WARMUP_FOUNDATION_QA_MARKER,
    healthy_count,
    paused_count,
    active_count,
    average_warmup_score,
    warming_count,
    new_count,
    throttled_count,
    draft_count: new_count,
    completed_count: active_count,
  }
}
