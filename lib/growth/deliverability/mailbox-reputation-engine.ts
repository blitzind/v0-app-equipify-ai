/** Deterministic mailbox reputation scoring — no AI. Client-safe. */

import type {
  GrowthMailboxReputationAssessment,
  GrowthMailboxReputationHealthTier,
  GrowthMailboxReputationMetrics,
} from "@/lib/growth/deliverability/reputation-protection-types"

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function tierFromScore(
  score: number,
  input: { paused?: boolean; warming?: boolean; protectedMode?: boolean },
): GrowthMailboxReputationHealthTier {
  if (input.paused) return "paused"
  if (input.protectedMode) return "protected"
  if (input.warming) return score >= 60 ? "warming" : "caution"
  if (score >= 80) return "healthy"
  if (score >= 60) return "caution"
  if (score >= 35) return "high_risk"
  return "paused"
}

export function computeMailboxReputationAssessment(input: {
  metrics: GrowthMailboxReputationMetrics
  sender_status?: string | null
  sender_health_status?: string | null
  daily_cap_utilization_pct?: number
}): GrowthMailboxReputationAssessment {
  const m = input.metrics
  const reasons: string[] = []
  const explanation: string[] = []
  let score = 100

  if (m.bounce_rate >= 8) {
    score -= 35
    reasons.push(`Bounce rate ${m.bounce_rate.toFixed(1)}% exceeds safe threshold.`)
    explanation.push(`Bounce penalty −35 (${m.bounce_rate.toFixed(1)}%).`)
  } else if (m.bounce_rate >= 4) {
    score -= 18
    reasons.push(`Elevated bounce rate ${m.bounce_rate.toFixed(1)}%.`)
    explanation.push(`Bounce caution −18.`)
  } else {
    explanation.push(`Bounce rate ${m.bounce_rate.toFixed(1)}% within normal range.`)
  }

  if (m.spam_complaint_rate >= 0.3) {
    score -= 40
    reasons.push(`Spam complaint rate ${m.spam_complaint_rate.toFixed(2)}% is critical.`)
    explanation.push(`Complaint penalty −40.`)
  } else if (m.spam_complaint_rate >= 0.1) {
    score -= 20
    reasons.push(`Complaint rate ${m.spam_complaint_rate.toFixed(2)}% elevated.`)
    explanation.push(`Complaint caution −20.`)
  }

  if (m.unsubscribe_rate >= 2) {
    score -= 15
    reasons.push(`Unsubscribe rate ${m.unsubscribe_rate.toFixed(1)}% spiking.`)
    explanation.push(`Unsubscribe spike −15.`)
  } else if (m.unsubscribe_rate >= 1) {
    score -= 8
    explanation.push(`Unsubscribe caution −8.`)
  }

  if (m.reply_rate > 0 && m.reply_rate < 1 && m.rolling_7d_send_volume >= 50) {
    score -= 10
    reasons.push(`Reply rate collapsed to ${m.reply_rate.toFixed(1)}%.`)
    explanation.push(`Low engagement −10.`)
  } else if (m.reply_rate >= 3) {
    score += 5
    explanation.push(`Healthy reply rate +5.`)
  }

  if (m.positive_reply_rate >= 2 && m.rolling_7d_send_volume >= 30) {
    score += 3
    explanation.push(`Positive reply momentum +3.`)
  } else if (
    m.positive_reply_rate > 0 &&
    m.positive_reply_rate < 0.5 &&
    m.reply_rate >= 2 &&
    m.rolling_7d_send_volume >= 40
  ) {
    score -= 6
    reasons.push(`Positive reply rate collapsed to ${m.positive_reply_rate.toFixed(1)}%.`)
    explanation.push(`Engagement quality −6.`)
  }

  if (m.open_rate > 0 && m.open_rate < 5 && m.rolling_7d_send_volume >= 80) {
    score -= 5
    reasons.push(`Open rate collapsed to ${m.open_rate.toFixed(1)}%.`)
    explanation.push(`Open engagement −5.`)
  }

  const capUtil = input.daily_cap_utilization_pct ?? 0
  if (capUtil >= 100) {
    score -= 12
    reasons.push("Daily send cap exhausted.")
    explanation.push(`Volume cap exhausted −12.`)
  } else if (capUtil >= 90) {
    score -= 6
    explanation.push(`High cap utilization −6 (${capUtil}%).`)
  }

  if (m.inactivity_days >= 21 && m.daily_send_count > 0) {
    score -= 8
    reasons.push(`Dormant mailbox resumed after ${m.inactivity_days} inactive days.`)
    explanation.push(`Dormant usage −8.`)
  }

  if (m.rolling_7d_send_volume >= 500 && m.bounce_rate < 2) {
    score += 4
    explanation.push(`Stable 7d volume +4.`)
  }

  if (m.sequence_participation_count >= 5 && m.bounce_rate >= 5) {
    score -= 10
    reasons.push("Sequence fatigue — elevated bounces across active sequences.")
    explanation.push(`Sequence fatigue −10.`)
  }

  if (input.sender_health_status === "critical" || input.sender_health_status === "blocked") {
    score -= 25
    reasons.push(`Sender health status: ${input.sender_health_status}.`)
  }

  if (input.sender_status === "disabled" || input.sender_status === "error") {
    score = 0
    reasons.push(`Sender status: ${input.sender_status}.`)
  }

  score = clampScore(score)
  const warming = (m.warmup_status ?? "").toLowerCase() === "warming"
  const paused =
    input.sender_status === "disabled" ||
    input.sender_health_status === "blocked" ||
    score < 25 ||
    m.bounce_rate >= 12 ||
    m.spam_complaint_rate >= 0.5

  const health_tier = tierFromScore(score, {
    paused,
    warming,
    protectedMode: score >= 70 && m.bounce_rate >= 6,
  })

  const recommended_actions: string[] = []
  if (health_tier === "paused" || health_tier === "high_risk") {
    recommended_actions.push("Pause outbound until operator reviews bounce/complaint trends.")
  }
  if (health_tier === "caution") recommended_actions.push("Reduce daily volume and review sequence copy.")
  if (warming) recommended_actions.push("Follow warmup ramp — do not exceed recommended daily volume.")
  if (capUtil >= 90) recommended_actions.push("Daily cap nearly exhausted — defer non-critical sends.")
  if (recommended_actions.length === 0) recommended_actions.push("Continue monitoring — reputation stable.")

  explanation.push(`Reputation risk score ${score}/100 · tier ${health_tier}.`)

  return {
    metrics: m,
    risk_score: score,
    health_tier,
    risk_reasons: reasons,
    recommended_actions,
    score_explanation: explanation,
  }
}

export function aggregateBounceTrend(
  assessments: GrowthMailboxReputationAssessment[],
): Array<{ label: string; rate: number; mailbox_count: number }> {
  const buckets = [
    { label: "Under 2%", min: 0, max: 2 },
    { label: "2–5%", min: 2, max: 5 },
    { label: "5–8%", min: 5, max: 8 },
    { label: "Over 8%", min: 8, max: 100 },
  ]
  return buckets.map((bucket) => ({
    label: bucket.label,
    rate: bucket.max === 100 ? 8 : bucket.max,
    mailbox_count: assessments.filter(
      (row) => row.metrics.bounce_rate >= bucket.min && row.metrics.bounce_rate < bucket.max,
    ).length,
  }))
}

export function aggregateComplaintTrend(
  assessments: GrowthMailboxReputationAssessment[],
): Array<{ label: string; rate: number; mailbox_count: number }> {
  const buckets = [
    { label: "None", min: 0, max: 0.05 },
    { label: "0.05–0.1%", min: 0.05, max: 0.1 },
    { label: "0.1–0.3%", min: 0.1, max: 0.3 },
    { label: "Over 0.3%", min: 0.3, max: 100 },
  ]
  return buckets.map((bucket) => ({
    label: bucket.label,
    rate: bucket.max === 100 ? 0.3 : bucket.max,
    mailbox_count: assessments.filter(
      (row) =>
        row.metrics.spam_complaint_rate >= bucket.min &&
        row.metrics.spam_complaint_rate < bucket.max,
    ).length,
  }))
}
