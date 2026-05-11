/**
 * Pure helpers for BlitzPay Phase 2K partial payments (no I/O).
 */

export type EffectivePartialPaymentPolicy = {
  /** Workspace wants partial pay UI. */
  orgPartialEnabled: boolean
  /** Platform master switch (admin-controlled). */
  platformPartialAllowed: boolean
  /** Minimum invoice portion when partial is effective (cents, >= 50). */
  minPortionCents: number
}

export function effectivePartialPaymentsEnabled(policy: EffectivePartialPaymentPolicy): boolean {
  return policy.platformPartialAllowed && policy.orgPartialEnabled
}

export function clampInvoicePortionCents(args: {
  balanceDueCents: number
  requestedPortionCents: number | null | undefined
  partialEnabled: boolean
  minPortionCents: number
}): { ok: true; portionCents: number } | { ok: false; code: string; message: string } {
  const balance = Math.max(0, Math.round(args.balanceDueCents))
  const minP = Math.max(50, Math.round(args.minPortionCents))
  if (balance < minP) {
    return { ok: false, code: "balance_below_minimum", message: "Balance due is below the minimum for online payment." }
  }
  const want =
    args.partialEnabled && args.requestedPortionCents != null && Number.isFinite(Number(args.requestedPortionCents)) ?
      Math.round(Number(args.requestedPortionCents))
    : balance
  if (!args.partialEnabled && want !== balance) {
    return { ok: false, code: "partial_not_allowed", message: "Partial payments are not enabled for this workspace." }
  }
  if (want < minP) {
    return { ok: false, code: "portion_below_minimum", message: `Amount must be at least ${(minP / 100).toFixed(2)} USD.` }
  }
  if (want > balance) {
    return { ok: false, code: "portion_exceeds_balance", message: "Amount cannot exceed the balance due." }
  }
  return { ok: true, portionCents: want }
}

export function remainingBalanceAfterPortion(balanceDueCents: number, portionCents: number): number {
  return Math.max(0, Math.round(balanceDueCents) - Math.round(portionCents))
}

export function buildScheduledExecutionStripeIdempotencyKey(scheduleRowId: string): string {
  return `blitzpay:scheduled_pi:v1:${scheduleRowId}`
}
