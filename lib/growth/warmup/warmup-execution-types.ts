/** Native mailbox warmup execution (Phase 6.31A). Client-safe. */

export const GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER = "growth-native-warmup-execution-v1" as const

export const GROWTH_NATIVE_WARMUP_EXECUTION_MIGRATION =
  "20270704120000_growth_native_warmup_execution.sql" as const

/** Day milestones for native ramp — interpolate between these points. */
export const NATIVE_WARMUP_DAY_MILESTONES = [
  { day: 1, volume: 5 },
  { day: 3, volume: 10 },
  { day: 7, volume: 20 },
  { day: 14, volume: 35 },
  { day: 21, volume: 50 },
  { day: 30, volume: 75 },
] as const

export type GrowthWarmupPreSendBlockCode =
  | "warmup_disabled"
  | "warmup_not_started"
  | "warmup_paused"
  | "warmup_throttled"
  | "warmup_cap_exhausted"

export type GrowthWarmupPreSendResult = {
  allowed: boolean
  reason: string | null
  blockCode: GrowthWarmupPreSendBlockCode | null
  daily_cap: number | null
  sends_today: number | null
  current_warmup_day: number | null
  profile_status: string | null
}

export type GrowthWarmupProgressionRunResult = {
  qa_marker: typeof GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER
  scanned: number
  capacity_synced: number
  day_advanced: number
  throttled: number
  activated: number
  daily_counters_reset: number
  sender_daily_resets: number
}
