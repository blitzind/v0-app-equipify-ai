/** Deterministic deliverability risk alerts — no AI scoring. Client-safe. */

import type {
  GrowthDeliverabilityGovernanceEventType,
  GrowthMailboxReputationAssessment,
  GrowthMailboxReputationHealthTier,
} from "@/lib/growth/deliverability/reputation-protection-types"

export const GROWTH_DELIVERABILITY_RISK_ALERT_RULES = [
  "bounce_spike",
  "complaint_spike",
  "unhealthy_ramp_velocity",
  "dormant_mailbox_activation",
  "excessive_send_velocity",
  "reply_collapse",
  "sequence_fatigue",
  "engagement_collapse",
] as const

export type GrowthDeliverabilityRiskAlertRule =
  (typeof GROWTH_DELIVERABILITY_RISK_ALERT_RULES)[number]

export type GrowthDeliverabilityRiskAlert = {
  rule_id: GrowthDeliverabilityRiskAlertRule
  event_type: GrowthDeliverabilityGovernanceEventType
  severity: "low" | "medium" | "high" | "critical"
  title: string
  summary: string
  metadata: Record<string, unknown>
}

export function evaluateDeliverabilityRiskAlerts(input: {
  assessment: GrowthMailboxReputationAssessment
  previousRiskScore?: number | null
  previousReplyRate?: number | null
  previousHealthTier?: GrowthMailboxReputationHealthTier | null
  dailyCapUtilizationPct?: number
}): GrowthDeliverabilityRiskAlert[] {
  const m = input.assessment.metrics
  const alerts: GrowthDeliverabilityRiskAlert[] = []
  const senderId = m.sender_account_id

  const push = (alert: GrowthDeliverabilityRiskAlert) => {
    alerts.push({ ...alert, metadata: { ...alert.metadata, sender_account_id: senderId } })
  }

  if (m.bounce_rate >= 8) {
    const delta = input.previousRiskScore != null ? input.assessment.risk_score - input.previousRiskScore : 0
    push({
      rule_id: "bounce_spike",
      event_type: "bounce_threshold_triggered",
      severity: m.bounce_rate >= 12 ? "critical" : "high",
      title: "Bounce spike detected",
      summary: `Bounce rate ${m.bounce_rate.toFixed(1)}% crossed safe threshold for ${m.email_address}.`,
      metadata: { bounce_rate: m.bounce_rate, risk_score_delta: delta },
    })
  }

  if (m.spam_complaint_rate >= 0.3) {
    push({
      rule_id: "complaint_spike",
      event_type: "complaint_threshold_triggered",
      severity: "critical",
      title: "Complaint spike detected",
      summary: `Complaint rate ${m.spam_complaint_rate.toFixed(2)}% is critical for ${m.email_address}.`,
      metadata: { spam_complaint_rate: m.spam_complaint_rate },
    })
  }

  const warming = (m.warmup_status ?? "").toLowerCase() === "warming"
  if (warming && m.bounce_rate >= 6 && m.daily_send_count >= 20) {
    push({
      rule_id: "unhealthy_ramp_velocity",
      event_type: "deliverability_risk_detected",
      severity: "high",
      title: "Unhealthy warmup ramp velocity",
      summary: `Warmup mailbox sending ${m.daily_send_count}/day with ${m.bounce_rate.toFixed(1)}% bounces.`,
      metadata: { daily_send_count: m.daily_send_count, bounce_rate: m.bounce_rate, warmup_status: m.warmup_status },
    })
  }

  if (m.inactivity_days >= 21 && m.daily_send_count > 0) {
    push({
      rule_id: "dormant_mailbox_activation",
      event_type: "deliverability_risk_detected",
      severity: "medium",
      title: "Dormant mailbox reactivated",
      summary: `Mailbox resumed after ${m.inactivity_days} inactive days with ${m.daily_send_count} sends today.`,
      metadata: { inactivity_days: m.inactivity_days, daily_send_count: m.daily_send_count },
    })
  }

  const capUtil = input.dailyCapUtilizationPct ?? 0
  if (capUtil >= 100) {
    push({
      rule_id: "excessive_send_velocity",
      event_type: "send_throttle_applied",
      severity: "high",
      title: "Excessive send velocity",
      summary: `Daily cap exhausted (${capUtil}% utilization) for ${m.email_address}.`,
      metadata: { cap_utilization_pct: capUtil },
    })
  }

  if (m.reply_rate > 0 && m.reply_rate < 1 && m.rolling_7d_send_volume >= 50) {
    push({
      rule_id: "reply_collapse",
      event_type: "deliverability_risk_detected",
      severity: "medium",
      title: "Reply rate collapsed",
      summary: `Reply rate dropped to ${m.reply_rate.toFixed(1)}% over ${m.rolling_7d_send_volume} 7d sends.`,
      metadata: { reply_rate: m.reply_rate, rolling_7d_send_volume: m.rolling_7d_send_volume },
    })
  }

  if (
    input.previousReplyRate != null &&
    input.previousReplyRate >= 2 &&
    m.reply_rate < input.previousReplyRate * 0.5 &&
    m.rolling_7d_send_volume >= 30
  ) {
    push({
      rule_id: "engagement_collapse",
      event_type: "deliverability_risk_detected",
      severity: "high",
      title: "Engagement collapse detected",
      summary: `Reply rate fell from ${input.previousReplyRate.toFixed(1)}% to ${m.reply_rate.toFixed(1)}%.`,
      metadata: {
        reply_rate: m.reply_rate,
        previous_reply_rate: input.previousReplyRate,
      },
    })
  }

  if (m.sequence_participation_count >= 5 && m.bounce_rate >= 5) {
    push({
      rule_id: "sequence_fatigue",
      event_type: "deliverability_risk_detected",
      severity: "high",
      title: "Sequence fatigue signal",
      summary: `${m.sequence_participation_count} active sequences with ${m.bounce_rate.toFixed(1)}% bounce rate.`,
      metadata: {
        sequence_participation_count: m.sequence_participation_count,
        bounce_rate: m.bounce_rate,
      },
    })
  }

  if (
    input.previousHealthTier &&
    input.previousHealthTier !== input.assessment.health_tier &&
    ["high_risk", "paused", "protected"].includes(input.assessment.health_tier)
  ) {
    push({
      rule_id: "engagement_collapse",
      event_type: "deliverability_risk_detected",
      severity: "medium",
      title: "Sender health tier degraded",
      summary: `Health tier changed ${input.previousHealthTier} → ${input.assessment.health_tier}.`,
      metadata: {
        previous_health_tier: input.previousHealthTier,
        health_tier: input.assessment.health_tier,
        risk_score: input.assessment.risk_score,
      },
    })
  }

  return alerts
}
