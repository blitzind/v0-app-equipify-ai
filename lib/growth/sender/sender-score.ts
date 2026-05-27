/** Deterministic sender score calculation. Client-safe. */

import type {
  GrowthSenderAccountStatus,
  GrowthSenderHealthStatus,
} from "@/lib/growth/sender/sender-types"

export type SenderScoreInput = {
  bounce_rate?: number | null
  spam_risk?: number | null
  spf_valid?: boolean | null
  dkim_valid?: boolean | null
  dmarc_valid?: boolean | null
  daily_send_used?: number | null
  daily_send_limit?: number | null
  status?: GrowthSenderAccountStatus | null
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function computeSenderScore(input: SenderScoreInput): number {
  let score = 100

  const bounceRate = input.bounce_rate ?? 0
  if (bounceRate > 0.05) score -= 25

  const spamRisk = input.spam_risk ?? 0
  if (spamRisk > 50) score -= 20

  if (input.spf_valid === false) score -= 15
  if (input.dkim_valid === false) score -= 15
  if (input.dmarc_valid === false) score -= 20

  const dailyUsed = input.daily_send_used ?? 0
  const dailyLimit = input.daily_send_limit ?? 0
  if (dailyLimit > 0 && dailyUsed > dailyLimit) score -= 15

  if (input.status === "warning") score -= 10
  if (input.status === "error") score -= 25

  return clampScore(score)
}

export function senderScoreToHealthStatus(score: number): GrowthSenderHealthStatus {
  if (score >= 90) return "healthy"
  if (score >= 70) return "warming"
  if (score >= 40) return "degraded"
  return "critical"
}

export function senderHealthStatusLabel(status: GrowthSenderHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy"
    case "warming":
      return "Warming"
    case "degraded":
      return "Degraded"
    case "critical":
      return "Critical"
  }
}
