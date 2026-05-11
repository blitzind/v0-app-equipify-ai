/**
 * Pure deposit math for org_quotes (BlitzPay Phase 2M).
 */

export type BlitzpayQuoteDepositMode = "none" | "acceptance" | "fixed" | "percentage" | "full_prepay"

export type BlitzpayQuoteDepositMathInput = {
  quoteAmountCents: number
  mode: BlitzpayQuoteDepositMode
  fixedCents: number | null | undefined
  percentageBps: number | null | undefined
}

export type BlitzpayQuoteDepositMathResult =
  | { ok: true; targetPayCents: number }
  | { ok: false; code: string; message: string }

const MIN_STRIPE_USD = 50

export function computeBlitzpayQuoteDepositTargetCents(input: BlitzpayQuoteDepositMathInput): BlitzpayQuoteDepositMathResult {
  const total = Math.round(Number(input.quoteAmountCents))
  if (!Number.isFinite(total) || total < 0) {
    return { ok: false, code: "invalid_quote_total", message: "Quote total is invalid." }
  }
  switch (input.mode) {
    case "none":
      return { ok: false, code: "deposit_disabled", message: "Estimate deposit is not enabled for this quote." }
    case "full_prepay": {
      const cap = Math.max(MIN_STRIPE_USD, total)
      return { ok: true, targetPayCents: cap }
    }
    case "fixed":
    case "acceptance": {
      const fixed = Math.round(Number(input.fixedCents ?? 0))
      if (!Number.isFinite(fixed) || fixed < MIN_STRIPE_USD) {
        return {
          ok: false,
          code: "invalid_fixed_deposit",
          message: "Set a fixed deposit of at least $0.50 (50 cents) for this mode.",
        }
      }
      return { ok: true, targetPayCents: Math.min(fixed, Math.max(MIN_STRIPE_USD, total)) }
    }
    case "percentage": {
      const bps = Math.round(Number(input.percentageBps ?? 0))
      if (!Number.isFinite(bps) || bps <= 0 || bps > 10000) {
        return { ok: false, code: "invalid_percentage", message: "Deposit percentage must be between 0.01% and 100%." }
      }
      const raw = Math.round((total * bps) / 10000)
      const pct = Math.max(MIN_STRIPE_USD, Math.min(raw, Math.max(MIN_STRIPE_USD, total)))
      return { ok: true, targetPayCents: pct }
    }
    default:
      return { ok: false, code: "unknown_mode", message: "Unknown deposit mode." }
  }
}

/** Remaining quote balance after a successful deposit capture (full prepay → 0). */
export function quoteRemainingAfterDepositCents(quoteTotalCents: number, collectedCents: number): number {
  const t = Math.round(quoteTotalCents)
  const c = Math.max(0, Math.round(collectedCents))
  return Math.max(0, t - c)
}
