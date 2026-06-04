/** Growth Engine — Warmup types (Phase 1D). Client-safe. */

export const GROWTH_WARMUP_FOUNDATION_QA_MARKER = "growth-warmup-foundation-v1" as const

/** Phase 6.31A native mailbox lifecycle (replaces draft/completed). */
export const GROWTH_WARMUP_PROFILE_STATUSES = [
  "new",
  "warming",
  "active",
  "throttled",
  "paused",
  "disabled",
] as const
export type GrowthWarmupProfileStatus = (typeof GROWTH_WARMUP_PROFILE_STATUSES)[number]

export const GROWTH_WARMUP_HEALTH_TIERS = ["healthy", "warning", "degraded", "critical"] as const
export type GrowthWarmupHealthTier = (typeof GROWTH_WARMUP_HEALTH_TIERS)[number]

export const GROWTH_WARMUP_EVENT_SEVERITIES = ["low", "medium", "high", "critical"] as const
export type GrowthWarmupEventSeverity = (typeof GROWTH_WARMUP_EVENT_SEVERITIES)[number]

export const GROWTH_WARMUP_TIMELINE_EVENT_TYPES = [
  "warmup_started",
  "warmup_paused",
  "warmup_completed",
  "warmup_health_declined",
  "warmup_progress_milestone",
  "warmup_stage_changed",
  "warmup_throttled",
] as const
export type GrowthWarmupTimelineEventType = (typeof GROWTH_WARMUP_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_WARMUP_PROGRESS_MILESTONES = [25, 50, 75, 100] as const

export type GrowthWarmupScheduleDay = {
  id: string
  warmup_profile_id: string
  day_number: number
  planned_volume: number
  actual_volume: number
  completed: boolean
  completed_at: string | null
  created_at: string
}

export type GrowthWarmupProfile = {
  id: string
  sender_account_id: string
  sender_email: string
  sender_display_name: string
  status: GrowthWarmupProfileStatus
  target_daily_volume: number
  current_daily_volume: number
  daily_increment: number
  warmup_days: number
  warmup_progress: number
  warmup_score: number
  warmup_health: GrowthWarmupHealthTier
  started_at: string | null
  completed_at: string | null
  last_progress_at: string | null
  current_warmup_day: number
  sends_today: number
  sends_today_date: string | null
  throttled_at: string | null
  throttle_reason: string | null
  last_capacity_sync_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  schedule?: GrowthWarmupScheduleDay[]
}

export type GrowthWarmupEvent = {
  id: string
  warmup_profile_id: string
  sender_email: string
  severity: GrowthWarmupEventSeverity
  event_type: string
  title: string
  description: string
  metadata: Record<string, unknown>
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

export type GrowthWarmupDashboard = {
  qa_marker: typeof GROWTH_WARMUP_FOUNDATION_QA_MARKER
  healthy_count: number
  paused_count: number
  active_count: number
  average_warmup_score: number
  warming_count: number
  new_count: number
  throttled_count: number
  /** @deprecated Use new_count */
  draft_count: number
  /** @deprecated Use active_count */
  completed_count: number
}

export const GROWTH_WARMUP_PRIVACY_NOTE =
  "Native warmup counts approved sequence transport sends toward daily ramp caps. No peer warmup bots or synthetic inbox placement."
