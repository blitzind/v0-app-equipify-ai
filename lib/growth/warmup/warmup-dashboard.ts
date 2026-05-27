/** Warmup dashboard aggregation. Client-safe. */

import {
  GROWTH_WARMUP_FOUNDATION_QA_MARKER,
  type GrowthWarmupDashboard,
  type GrowthWarmupProfile,
} from "@/lib/growth/warmup/warmup-types"

export function buildWarmupDashboard(profiles: GrowthWarmupProfile[]): GrowthWarmupDashboard {
  const healthy_count = profiles.filter((profile) => profile.warmup_health === "healthy").length
  const paused_count = profiles.filter((profile) => profile.status === "paused").length
  const completed_count = profiles.filter((profile) => profile.status === "completed").length
  const warming_count = profiles.filter((profile) => profile.status === "warming").length
  const draft_count = profiles.filter((profile) => profile.status === "draft").length

  const average_warmup_score =
    profiles.length > 0
      ? Math.round(profiles.reduce((sum, profile) => sum + profile.warmup_score, 0) / profiles.length)
      : 0

  return {
    qa_marker: GROWTH_WARMUP_FOUNDATION_QA_MARKER,
    healthy_count,
    paused_count,
    completed_count,
    average_warmup_score,
    warming_count,
    draft_count,
  }
}
