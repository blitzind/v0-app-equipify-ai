/** Phase 6.31C — Health-aware sender routing (client-safe). */

import type { GrowthMailboxHealthState } from "@/lib/growth/deliverability/mailbox-health-score-types"

export const GROWTH_HEALTH_AWARE_ROUTING_QA_MARKER = "growth-health-aware-routing-v1" as const

export const GROWTH_REPUTATION_TREND_DIRECTIONS = [
  "improving",
  "declining",
  "stable",
  "unknown",
] as const
export type GrowthReputationTrendDirection = (typeof GROWTH_REPUTATION_TREND_DIRECTIONS)[number]

export type GrowthSenderCapacityMetrics = {
  daily_capacity: number
  sends_today: number
  remaining_capacity: number
  utilization_pct: number
  projected_exhaustion_hours: number | null
}

export type GrowthSenderRoutingInsight = {
  sender_account_id: string
  sender_label: string
  sender_pool_id: string | null
  routing_score: number
  mailbox_health_score: number
  mailbox_health_state: GrowthMailboxHealthState
  remaining_capacity: number
  utilization_pct: number
  projected_exhaustion_hours: number | null
  routing_eligible: boolean
  recommended_action: string | null
  reputation_trend: GrowthReputationTrendDirection
  throttle_status: "ok" | "throttled" | "paused"
  warmup_status: string | null
  delivery_success_rate: number
  route_balancing_note: string | null
}
