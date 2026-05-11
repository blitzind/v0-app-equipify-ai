/**
 * Deterministic autopay / scheduled renewal helpers (Phase 2W).
 * No Stripe calls — idempotency key shapes only; execution stays in `blitzpay-scheduled-payments.ts`.
 */

/** Hours between deterministic retry attempts after a failed off-session run (max 3 retries). */
export const BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS = [24, 72, 168] as const

/** Grace window (hours) after a failed attempt before first retry is offered in UI math. */
export const BLITZPAY_AUTOPAY_GRACE_HOURS_DEFAULT = 6

export function buildDeterministicAutopayRetryScheduleUtc(
  firstFailureAtUtcMs: number,
  maxAttempts = 3,
): number[] {
  const base = Number(firstFailureAtUtcMs)
  if (!Number.isFinite(base) || base <= 0) return []
  const out: number[] = []
  let t = base + BLITZPAY_AUTOPAY_GRACE_HOURS_DEFAULT * 3600_000
  for (let i = 0; i < Math.min(maxAttempts, BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS.length); i++) {
    t += BLITZPAY_AUTOPAY_RETRY_INTERVALS_HOURS[i] * 3600_000
    out.push(t)
  }
  return out
}

/**
 * Stable idempotency key for a hypothetical renewal retry PI (v1 namespace).
 * Callers must not reuse the primary schedule execution key.
 */
export function blitzpayAutopayRenewalRetryIdempotencyKeyV1(scheduleId: string, retryIndex: number): string {
  const sid = String(scheduleId || "").trim()
  const idx = Math.max(0, Math.floor(Number(retryIndex)))
  return `blitzpay:schedule_retry:v1:${sid}:${idx}`
}

export function walletAssistedRenewalRecoverySuggested(args: {
  invoiceBalanceDueCents: number
  walletSpendableCents: number
}): boolean {
  const bal = Math.max(0, Math.round(args.invoiceBalanceDueCents))
  const w = Math.max(0, Math.round(args.walletSpendableCents))
  return w >= 50 && bal >= 50 && w >= Math.min(bal, Math.floor(bal * 0.25))
}
