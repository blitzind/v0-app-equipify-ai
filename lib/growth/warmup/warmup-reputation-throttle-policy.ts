/** GS-GROWTH-WARMUP-REPUTATION-THROTTLE-FIX-1L — controlled warmup throttle policy (client-safe). */

import type { GrowthMailboxReputationAssessment } from "@/lib/growth/deliverability/reputation-protection-types"
import type { GrowthWarmupHealthTier, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"

export const GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER =
  "growth-warmup-reputation-throttle-fix-1l-v1" as const

/** Aligns with DEFAULT_MAILBOX_SEND_POLICY auto-pause thresholds. */
export const WARMUP_BOUNCE_HARD_THRESHOLD_PCT = 8 as const
export const WARMUP_COMPLAINT_HARD_THRESHOLD_PCT = 0.3 as const

export type WarmupThrottleClassification =
  | "none"
  | "legitimate_critical_risk"
  | "legitimate_daily_velocity_reduction"
  | "stale_throttle"
  | "false_positive_dns_stub"
  | "false_positive_health_mismatch"
  | "unknown"

export type WarmupReputationThrottleAction = "allow" | "velocity_reduction" | "full_throttle"

export type WarmupReputationThrottleDecision = {
  action: WarmupReputationThrottleAction
  reason: string | null
  blockCode: string | null
  velocityReductionFactor: number
  classification: WarmupThrottleClassification
}

export type WarmupThrottleClearEvaluation = {
  canClear: boolean
  reason: string
  classification: WarmupThrottleClassification
}

export type WarmupReputationThrottleInput = {
  profileWarmupHealth: GrowthWarmupHealthTier
  profileStatus?: GrowthWarmupProfileStatus
  senderStatus: string | null | undefined
  senderHealthStatus: string | null | undefined
  reputation: Pick<
    GrowthMailboxReputationAssessment,
    "health_tier" | "risk_score" | "risk_reasons" | "metrics"
  > | null
}

function fullThrottle(
  reason: string,
  blockCode: string,
  classification: WarmupThrottleClassification = "legitimate_critical_risk",
): WarmupReputationThrottleDecision {
  return {
    action: "full_throttle",
    reason,
    blockCode,
    velocityReductionFactor: 0,
    classification,
  }
}

function velocityReduction(
  reason: string,
  factor: number,
): WarmupReputationThrottleDecision {
  return {
    action: "velocity_reduction",
    reason,
    blockCode: "reputation_velocity_reduction",
    velocityReductionFactor: factor,
    classification: "legitimate_daily_velocity_reduction",
  }
}

export function evaluateWarmupReputationThrottle(
  input: WarmupReputationThrottleInput,
): WarmupReputationThrottleDecision {
  const senderStatus = (input.senderStatus ?? "").toLowerCase()
  const senderHealth = (input.senderHealthStatus ?? "").toLowerCase()
  const metrics = input.reputation?.metrics

  if (input.profileWarmupHealth === "critical") {
    return fullThrottle(
      "Warmup health is critical — executor sends paused.",
      "warmup_health_critical",
    )
  }

  if (senderHealth === "critical") {
    return fullThrottle(
      "Sender health is critical — operator review required.",
      "sender_health_critical",
    )
  }

  if (senderHealth === "blocked") {
    return fullThrottle(
      "Sender health is blocked — operator review required.",
      "sender_health_blocked",
    )
  }

  if (senderStatus && senderStatus !== "connected") {
    return fullThrottle(
      `Sender not connected (${input.senderStatus}).`,
      "sender_not_connected",
    )
  }

  if (input.reputation) {
    const bounceRate = metrics?.bounce_rate ?? 0
    const complaintRate = metrics?.spam_complaint_rate ?? 0
    const tier = input.reputation.health_tier

    if (bounceRate >= WARMUP_BOUNCE_HARD_THRESHOLD_PCT) {
      return fullThrottle(
        `Bounce rate ${bounceRate.toFixed(1)}% exceeds hard threshold (${WARMUP_BOUNCE_HARD_THRESHOLD_PCT}%).`,
        "bounce_hard_threshold",
      )
    }

    if (complaintRate >= WARMUP_COMPLAINT_HARD_THRESHOLD_PCT) {
      return fullThrottle(
        `Spam complaint rate ${complaintRate.toFixed(2)}% crossed hard threshold.`,
        "complaint_hard_threshold",
      )
    }

    if (tier === "paused" || tier === "protected") {
      return fullThrottle(
        input.reputation.risk_reasons[0] ?? "Mailbox reputation requires pause.",
        "reputation_paused",
      )
    }

    if (tier === "high_risk" || tier === "caution") {
      const softReason =
        input.reputation.risk_reasons[0] ??
        `Reputation tier ${tier} — reduced velocity recommended (controlled warmup continues).`
      return velocityReduction(softReason, tier === "high_risk" ? 0.5 : 0.75)
    }
  }

  return {
    action: "allow",
    reason: null,
    blockCode: null,
    velocityReductionFactor: 1,
    classification: "none",
  }
}

export function evaluateWarmupThrottleClear(
  input: WarmupReputationThrottleInput,
): WarmupThrottleClearEvaluation {
  const decision = evaluateWarmupReputationThrottle(input)

  if (decision.action === "full_throttle") {
    return {
      canClear: false,
      reason: decision.reason ?? "Reputation protection still requires a full stop.",
      classification: decision.classification,
    }
  }

  if (input.profileStatus === "throttled") {
    return {
      canClear: true,
      reason:
        decision.action === "velocity_reduction"
          ? `Controlled warmup allowed — ${decision.reason ?? "velocity reduction warning only."}`
          : "Controlled warmup allowed — stale throttle can be cleared.",
      classification: decision.action === "allow" ? "stale_throttle" : decision.classification,
    }
  }

  return {
    canClear: false,
    reason: "Profile is not throttled.",
    classification: "none",
  }
}

export function isWarmupThrottleLikelyClearable(input: {
  profileStatus: GrowthWarmupProfileStatus
  profileWarmupHealth: GrowthWarmupHealthTier
  senderStatus?: string | null
  senderHealthStatus?: string | null
}): boolean {
  if (input.profileStatus !== "throttled") return false
  if (input.profileWarmupHealth === "critical") return false
  const senderStatus = (input.senderStatus ?? "").toLowerCase()
  const senderHealth = (input.senderHealthStatus ?? "").toLowerCase()
  if (senderStatus !== "connected") return false
  if (senderHealth === "critical" || senderHealth === "blocked") return false
  return true
}

export function applyWarmupVelocityReduction(plannedVolume: number, factor: number): number {
  if (factor >= 1 || plannedVolume <= 0) return plannedVolume
  return Math.max(1, Math.floor(plannedVolume * factor))
}
