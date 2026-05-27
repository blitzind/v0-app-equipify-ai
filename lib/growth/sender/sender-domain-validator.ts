/** Stub-safe domain validation — no DNS execution in Phase 1A. Client-safe. */

import { computeSenderScore } from "@/lib/growth/sender/sender-score"
import type { GrowthSenderDomainStatus } from "@/lib/growth/sender/sender-types"

export type SenderDomainValidationInput = {
  domain: string
  spf_valid?: boolean
  dkim_valid?: boolean
  dmarc_valid?: boolean
  mx_valid?: boolean
  bounce_rate?: number | null
  reply_rate?: number | null
  spam_risk?: number | null
}

export type SenderDomainValidationResult = {
  domain: string
  status: GrowthSenderDomainStatus
  spf_valid: boolean
  dkim_valid: boolean
  dmarc_valid: boolean
  mx_valid: boolean
  deliverability_score: number
  reputation_score: number
  health_summary: string
  dns_checked_at: string
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "")
}

export function validateSenderDomainStub(input: SenderDomainValidationInput): SenderDomainValidationResult {
  const domain = normalizeDomain(input.domain)
  const spf_valid = input.spf_valid ?? false
  const dkim_valid = input.dkim_valid ?? false
  const dmarc_valid = input.dmarc_valid ?? false
  const mx_valid = input.mx_valid ?? false

  const dnsCheckedCount = [spf_valid, dkim_valid, dmarc_valid, mx_valid].filter(Boolean).length
  const deliverability_score = Math.round((dnsCheckedCount / 4) * 100)
  const reputation_score = computeSenderScore({
    bounce_rate: input.bounce_rate,
    spam_risk: input.spam_risk,
    spf_valid,
    dkim_valid,
    dmarc_valid,
  })

  let status: GrowthSenderDomainStatus = "pending"
  if (dnsCheckedCount === 0) {
    status = "pending"
  } else if (!spf_valid || !dkim_valid || !dmarc_valid || !mx_valid) {
    status = deliverability_score >= 50 ? "warning" : "invalid"
  } else if ((input.spam_risk ?? 0) > 50 || deliverability_score < 70) {
    status = "warning"
  } else {
    status = "valid"
  }

  const health_summary =
    status === "pending"
      ? "DNS validation not executed — infrastructure stub only."
      : `${dnsCheckedCount}/4 DNS checks recorded. Deliverability ${deliverability_score}/100.`

  return {
    domain,
    status,
    spf_valid,
    dkim_valid,
    dmarc_valid,
    mx_valid,
    deliverability_score,
    reputation_score,
    health_summary,
    dns_checked_at: new Date().toISOString(),
  }
}

export function extractDomainFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf("@")
  if (at <= 0 || at === normalized.length - 1) return null
  return normalized.slice(at + 1)
}
