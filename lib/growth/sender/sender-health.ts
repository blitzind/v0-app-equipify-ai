/** Sender health evaluation helpers. Client-safe. */

import { computeSenderScore, senderScoreToHealthStatus } from "@/lib/growth/sender/sender-score"
import type { SenderScoreInput } from "@/lib/growth/sender/sender-score"
import type {
  GrowthSenderDomain,
  GrowthSenderHealthStatus,
} from "@/lib/growth/sender/sender-types"

export type SenderHealthEvaluation = {
  sender_score: number
  health_status: GrowthSenderHealthStatus
  reasons: string[]
}

export function evaluateSenderHealth(input: SenderScoreInput): SenderHealthEvaluation {
  const sender_score = computeSenderScore(input)
  const health_status = senderScoreToHealthStatus(sender_score)
  const reasons: string[] = []

  if ((input.bounce_rate ?? 0) > 0.05) reasons.push("Bounce rate above 5%")
  if ((input.spam_risk ?? 0) > 50) reasons.push("Spam risk above threshold")
  if (input.spf_valid === false) reasons.push("SPF invalid")
  if (input.dkim_valid === false) reasons.push("DKIM invalid")
  if (input.dmarc_valid === false) reasons.push("DMARC invalid")
  if (
    (input.daily_send_limit ?? 0) > 0 &&
    (input.daily_send_used ?? 0) > (input.daily_send_limit ?? 0)
  ) {
    reasons.push("Daily send volume exceeds limit")
  }
  if (input.status === "warning") reasons.push("Sender status warning")
  if (input.status === "error") reasons.push("Sender status error")

  return { sender_score, health_status, reasons }
}

export function evaluateDomainHealthStatus(domain: Pick<
  GrowthSenderDomain,
  "spf_valid" | "dkim_valid" | "dmarc_valid" | "mx_valid" | "deliverability_score" | "spam_risk"
>): "valid" | "warning" | "invalid" | "pending" {
  const dnsValid = domain.spf_valid && domain.dkim_valid && domain.dmarc_valid && domain.mx_valid
  if (!domain.spf_valid && !domain.dkim_valid && !domain.dmarc_valid && !domain.mx_valid) {
    return "pending"
  }
  if (!dnsValid || (domain.deliverability_score ?? 0) < 40) return "invalid"
  if ((domain.spam_risk ?? 0) > 50 || domain.deliverability_score < 70) return "warning"
  return "valid"
}
