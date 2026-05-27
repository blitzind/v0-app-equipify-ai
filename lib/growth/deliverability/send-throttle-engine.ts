/** Deterministic send throttle + pause rules. Client-safe. */

import type {
  GrowthDeliverabilityGovernanceEventType,
  GrowthMailboxReputationAssessment,
  GrowthMailboxSendPolicy,
  GrowthSendThrottleDecision,
} from "@/lib/growth/deliverability/reputation-protection-types"

export const DEFAULT_MAILBOX_SEND_POLICY: GrowthMailboxSendPolicy = {
  sender_account_id: "",
  daily_send_cap: 50,
  hourly_send_cap: 12,
  minimum_delay_seconds: 120,
  sequence_concurrency_limit: 3,
  cooldown_hours: 24,
  auto_pause_on_bounce_threshold: 8,
  auto_pause_on_complaint_threshold: 0.3,
  operator_override: false,
  override_reason: null,
}

export function evaluateSendThrottle(input: {
  policy: GrowthMailboxSendPolicy
  assessment: GrowthMailboxReputationAssessment
  sends_last_hour?: number
  active_sequence_count?: number
  last_send_at?: string | null
  now?: number
}): GrowthSendThrottleDecision {
  const now = input.now ?? Date.now()
  const m = input.assessment.metrics
  const policy = input.policy

  if (policy.operator_override) {
    return {
      allowed: true,
      throttled: false,
      paused: false,
      reason: policy.override_reason ?? "Operator override active.",
      rule_id: "operator_override",
      recommended_delay_seconds: policy.minimum_delay_seconds,
    }
  }

  if (
    assessmentPaused(input.assessment) ||
    m.bounce_rate >= policy.auto_pause_on_bounce_threshold ||
    m.spam_complaint_rate >= policy.auto_pause_on_complaint_threshold
  ) {
    return {
      allowed: false,
      throttled: false,
      paused: true,
      reason:
        m.bounce_rate >= policy.auto_pause_on_bounce_threshold
          ? `Auto-pause: bounce rate ${m.bounce_rate.toFixed(1)}% crossed ${policy.auto_pause_on_bounce_threshold}%.`
          : m.spam_complaint_rate >= policy.auto_pause_on_complaint_threshold
            ? `Auto-pause: complaint rate crossed threshold.`
            : `Mailbox reputation tier ${input.assessment.health_tier} requires pause.`,
      rule_id: "auto_pause_threshold",
      recommended_delay_seconds: policy.cooldown_hours * 3600,
    }
  }

  if (m.daily_send_count >= policy.daily_send_cap) {
    return {
      allowed: false,
      throttled: true,
      paused: false,
      reason: `Daily send cap ${policy.daily_send_cap} reached.`,
      rule_id: "daily_cap",
      recommended_delay_seconds: null,
    }
  }

  const sendsLastHour = input.sends_last_hour ?? 0
  if (sendsLastHour >= policy.hourly_send_cap) {
    return {
      allowed: false,
      throttled: true,
      paused: false,
      reason: `Hourly send cap ${policy.hourly_send_cap} reached.`,
      rule_id: "hourly_cap",
      recommended_delay_seconds: 3600,
    }
  }

  const activeSequences = input.active_sequence_count ?? m.sequence_participation_count
  if (activeSequences > policy.sequence_concurrency_limit) {
    return {
      allowed: false,
      throttled: true,
      paused: false,
      reason: `Sequence concurrency limit ${policy.sequence_concurrency_limit} exceeded.`,
      rule_id: "sequence_concurrency",
      recommended_delay_seconds: policy.minimum_delay_seconds,
    }
  }

  if (input.last_send_at) {
    const elapsed = (now - Date.parse(input.last_send_at)) / 1000
    if (elapsed < policy.minimum_delay_seconds) {
      return {
        allowed: false,
        throttled: true,
        paused: false,
        reason: `Minimum delay ${policy.minimum_delay_seconds}s between sends.`,
        rule_id: "minimum_delay",
        recommended_delay_seconds: Math.ceil(policy.minimum_delay_seconds - elapsed),
      }
    }
  }

  if (input.assessment.health_tier === "caution" || input.assessment.health_tier === "high_risk") {
    return {
      allowed: true,
      throttled: true,
      paused: false,
      reason: `Throttle active — ${input.assessment.health_tier} reputation tier.`,
      rule_id: "reputation_throttle",
      recommended_delay_seconds: policy.minimum_delay_seconds * 2,
    }
  }

  if (m.unsubscribe_rate >= 1.5) {
    return {
      allowed: true,
      throttled: true,
      paused: false,
      reason: "Unsubscribe spike — reduced send velocity recommended.",
      rule_id: "unsubscribe_spike",
      recommended_delay_seconds: policy.minimum_delay_seconds * 3,
    }
  }

  return {
    allowed: true,
    throttled: false,
    paused: false,
    reason: null,
    rule_id: null,
    recommended_delay_seconds: policy.minimum_delay_seconds,
  }
}

function assessmentPaused(assessment: GrowthMailboxReputationAssessment): boolean {
  return assessment.health_tier === "paused" || assessment.health_tier === "protected"
}

export function governanceEventTypeForThrottle(
  decision: GrowthSendThrottleDecision,
  _assessment?: GrowthMailboxReputationAssessment,
): GrowthDeliverabilityGovernanceEventType | null {
  if (decision.paused && decision.rule_id === "auto_pause_threshold") {
    if (decision.reason?.toLowerCase().includes("complaint")) {
      return "complaint_threshold_triggered"
    }
    if (decision.reason?.toLowerCase().includes("bounce")) {
      return "bounce_threshold_triggered"
    }
    return "mailbox_paused"
  }
  if (decision.paused) return "mailbox_paused"
  if (decision.throttled) return "send_throttle_applied"
  return null
}
