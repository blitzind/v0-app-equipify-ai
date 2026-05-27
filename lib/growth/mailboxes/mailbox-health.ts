/** Deterministic mailbox connection health scoring. Client-safe. */

import type {
  GrowthMailboxConnectionStatus,
  GrowthMailboxHealthTier,
} from "@/lib/growth/mailboxes/mailbox-types"

export type MailboxHealthInput = {
  status?: GrowthMailboxConnectionStatus | null
  token_expires_at?: string | null
  validation_failure_count?: number | null
  now?: number
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function isMailboxTokenExpired(tokenExpiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!tokenExpiresAt) return false
  const expires = Date.parse(tokenExpiresAt)
  return Number.isFinite(expires) && expires <= now
}

export function computeMailboxConnectionHealth(input: MailboxHealthInput): number {
  let score = 100
  const now = input.now ?? Date.now()

  if (isMailboxTokenExpired(input.token_expires_at, now) || input.status === "expired") {
    score -= 50
  }

  const failures = input.validation_failure_count ?? 0
  if (failures > 3) score -= 20

  if (input.status === "warning") score -= 10
  if (input.status === "error") score -= 25

  return clampScore(score)
}

export function mailboxHealthToTier(score: number): GrowthMailboxHealthTier {
  if (score >= 90) return "healthy"
  if (score >= 70) return "warning"
  if (score >= 40) return "degraded"
  return "critical"
}

export function buildMailboxHealthReason(input: MailboxHealthInput & { score: number }): string | null {
  const reasons: string[] = []
  if (isMailboxTokenExpired(input.token_expires_at, input.now)) reasons.push("Token expired")
  if ((input.validation_failure_count ?? 0) > 3) reasons.push("Validation failures exceed threshold")
  if (input.status === "warning") reasons.push("Connection status warning")
  if (input.status === "error") reasons.push("Connection status error")
  if (input.status === "expired") reasons.push("Connection expired")
  if (reasons.length === 0 && input.score >= 90) return null
  return reasons.length > 0 ? reasons.join("; ") : `Connection health ${input.score}/100`
}
