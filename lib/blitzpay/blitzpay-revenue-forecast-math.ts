/**
 * Pure helpers for BlitzPay revenue forecasting (Phase 2Q).
 * Callers supply cents from DB aggregates; no I/O here.
 */

export type BlitzpayForecastHorizonsCents = {
  next7DaysExpectedCents: number
  next30DaysExpectedCents: number
  next60DaysExpectedCents: number
}

export type BlitzpayForecastInputs = {
  /** Sum of pending scheduled invoice payment amounts due within each horizon (from `blitzpay_scheduled_invoice_payments`). */
  scheduledPendingDueWithin7Cents: number
  scheduledPendingDueWithin30Cents: number
  scheduledPendingDueWithin60Cents: number
  /** Remaining installment targets due within horizon (sum of max(0, target - paid) for rows with due_on in range). */
  installmentRemainingDueWithin7Cents: number
  installmentRemainingDueWithin30Cents: number
  installmentRemainingDueWithin60Cents: number
  /**
   * Heuristic: portion of overdue AR considered “likely” to collect, based on reminder performance.
   * Caller passes overdueCollectibleBalanceCents * recoveryMultiplier.
   */
  overdueRecoveryExpectedCents: number
  /** Estimate deposits pipeline attributed to each horizon (caller splits unapplied deposits conservatively). */
  estimateDepositPipelineCents7: number
  estimateDepositPipelineCents30: number
  estimateDepositPipelineCents60: number
}

/**
 * Expected inflow bands = scheduled + installments + recovery heuristic + deposit pipeline.
 * ACH pending is surfaced separately for cash timing, not double-counted in optimistic inflow.
 */
export function buildBlitzpayForecastHorizonsCents(input: BlitzpayForecastInputs): BlitzpayForecastHorizonsCents {
  const base7 =
    input.scheduledPendingDueWithin7Cents +
    input.installmentRemainingDueWithin7Cents +
    input.overdueRecoveryExpectedCents +
    input.estimateDepositPipelineCents7
  const base30 =
    input.scheduledPendingDueWithin30Cents +
    input.installmentRemainingDueWithin30Cents +
    input.overdueRecoveryExpectedCents +
    input.estimateDepositPipelineCents30
  const base60 =
    input.scheduledPendingDueWithin60Cents +
    input.installmentRemainingDueWithin60Cents +
    input.overdueRecoveryExpectedCents +
    input.estimateDepositPipelineCents60

  return {
    next7DaysExpectedCents: Math.max(0, Math.round(base7)),
    next30DaysExpectedCents: Math.max(0, Math.round(base30)),
    next60DaysExpectedCents: Math.max(0, Math.round(base60)),
  }
}

/** Wallet liability = spendable + refundable (both are balance-sheet style credits). */
export function blitzpayWalletLiabilityCents(spendableCreditCents: number, refundableCreditCents: number): number {
  return Math.max(0, Math.round(spendableCreditCents)) + Math.max(0, Math.round(refundableCreditCents))
}

/**
 * Map reminder “sent / total” into a conservative expected recovery fraction of overdue AR.
 * Clamped to [5%, 35%].
 */
export function blitzpayOverdueRecoveryMultiplier(reminderEffectivenessRatePct: number): number {
  const raw = Number(reminderEffectivenessRatePct)
  if (!Number.isFinite(raw) || raw <= 0) return 0.05
  const m = raw / 100
  return Math.min(0.35, Math.max(0.05, m))
}
