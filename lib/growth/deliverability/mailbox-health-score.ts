/** Phase 6.31B — deterministic mailbox health score + state (client-safe). */

import type {
  GrowthMailboxHealthState,
  GrowthMailboxHealthTrendPoint,
} from "@/lib/growth/deliverability/mailbox-health-score-types"
import type {
  GrowthMailboxReputationAssessment,
  GrowthMailboxReputationHealthTier,
} from "@/lib/growth/deliverability/reputation-protection-types"

export type MailboxHealthScoreInput = {
  assessment: GrowthMailboxReputationAssessment
  sender_status?: string | null
  sender_health_status?: string | null
  warmup_status?: string | null
  warmup_throttled?: boolean
  deliverability_paused?: boolean
  throttle_events_7d?: number
  delivery_success_rate?: number
}

/** Health score 0–100 where higher is healthier (aligns with reputation risk_score). */
export function computeMailboxHealthScore(input: MailboxHealthScoreInput): number {
  let score = input.assessment.risk_score

  if ((input.throttle_events_7d ?? 0) >= 2) score -= 8
  else if ((input.throttle_events_7d ?? 0) >= 1) score -= 4

  const deliverySuccess = input.delivery_success_rate
  if (deliverySuccess != null && deliverySuccess < 85 && input.assessment.metrics.rolling_7d_send_volume >= 20) {
    score -= 10
  } else if (deliverySuccess != null && deliverySuccess >= 95) {
    score += 2
  }

  if (input.warmup_throttled) score -= 12
  if (input.warmup_status === "paused") score -= 6

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function deriveMailboxHealthState(input: MailboxHealthScoreInput): GrowthMailboxHealthState {
  const senderStatus = (input.sender_status ?? "").toLowerCase()
  if (senderStatus === "disabled" || senderStatus === "error") return "disabled"
  if (input.deliverability_paused) return "critical"
  if (input.warmup_status === "disabled") return "disabled"

  const score = computeMailboxHealthScore(input)
  const tier = input.assessment.health_tier

  if (tier === "paused" || score < 25) return "critical"
  if (input.warmup_throttled || tier === "high_risk" || score < 45) return "at_risk"
  if (tier === "caution" || tier === "protected" || score < 65) return "warning"
  if (tier === "warming" && score < 75) return "warning"
  if (score >= 80 && tier === "healthy") return "healthy"
  if (score >= 65) return "healthy"
  return "warning"
}

export function mapReputationTierToHealthStateLabel(tier: GrowthMailboxReputationHealthTier): GrowthMailboxHealthState {
  switch (tier) {
    case "healthy":
    case "warming":
      return "healthy"
    case "caution":
      return "warning"
    case "high_risk":
    case "protected":
      return "at_risk"
    case "paused":
      return "critical"
    default:
      return "warning"
  }
}

export function mailboxHealthStateLabel(state: GrowthMailboxHealthState): string {
  switch (state) {
    case "healthy":
      return "Healthy"
    case "warning":
      return "Warning"
    case "at_risk":
      return "At risk"
    case "critical":
      return "Critical"
    case "disabled":
      return "Disabled"
  }
}

export function buildHealthTrendDirection(
  points: GrowthMailboxHealthTrendPoint[],
): "improving" | "declining" | "stable" | "unknown" {
  if (points.length < 2) return "unknown"
  const sorted = [...points].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const first = sorted[0].health_score
  const last = sorted[sorted.length - 1].health_score
  const delta = last - first
  if (delta >= 8) return "improving"
  if (delta <= -8) return "declining"
  return "stable"
}

export function buildThrottleRecommendation(input: {
  throttled: boolean
  paused: boolean
  reason: string | null
  minimum_delay_seconds?: number | null
}): string | null {
  if (input.paused) {
    return input.reason ?? "Mailbox paused — resolve deliverability issues before resuming sends."
  }
  if (input.throttled) {
    const delay =
      input.minimum_delay_seconds != null && input.minimum_delay_seconds > 0
        ? ` Space sends at least ${input.minimum_delay_seconds}s apart.`
        : ""
    return (input.reason ?? "Reduce send velocity — reputation throttle active.") + delay
  }
  return null
}

export function buildCapacityRecommendation(input: {
  daily_capacity: number
  sends_today: number
  warmup_status: string | null
  cap_utilization_pct: number
  unsafe_to_scale?: boolean
}): string | null {
  if (input.unsafe_to_scale) {
    return "Unsafe to scale — address bounce/complaint signals before increasing volume."
  }
  const remaining = Math.max(0, input.daily_capacity - input.sends_today)
  if (input.cap_utilization_pct >= 100) {
    return `Daily capacity exhausted (${input.sends_today}/${input.daily_capacity}). Defer non-critical sends until UTC reset.`
  }
  if (input.cap_utilization_pct >= 90) {
    return `${remaining} sends remaining today of ${input.daily_capacity} capacity.`
  }
  if (input.warmup_status === "warming") {
    return `Warmup active — stay within ${input.daily_capacity} sends/day ramp cap (${remaining} remaining today).`
  }
  if (input.warmup_status === "new") {
    return "Generate warmup schedule before scaling outbound volume."
  }
  return null
}
