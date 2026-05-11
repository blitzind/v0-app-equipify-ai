import { assertNonNegativeCents } from "@/lib/blitzpay/money"

export type BlitzpayFeeMode = "merchant_absorbs" | "customer_pass_through" | "customer_partial_pass_through"

export type BlitzpayConvenienceFeeSettings = {
  passProcessingFeesToCustomer: boolean
  feeMode: BlitzpayFeeMode
  /** Percent value (e.g. 2.9 means 2.9%). */
  feePercentageSnapshot: number
  feeCapCents: number | null
  disclosureCopy: string
}

export type BlitzpayConvenienceFeePreview = {
  invoiceBalanceCents: number
  convenienceFeeCents: number
  totalChargeCents: number
  appliesToCustomer: boolean
  disclosureCopy: string
}

export const DEFAULT_BLITZPAY_DISCLOSURE_COPY = "A processing fee is applied for online card payments."

function roundCentsFromPercent(baseCents: number, percent: number): number {
  const raw = (baseCents * percent) / 100
  return Math.max(0, Math.round(raw))
}

export function computeBlitzpayConvenienceFeePreview(args: {
  invoiceBalanceCents: number
  settings: BlitzpayConvenienceFeeSettings
}): BlitzpayConvenienceFeePreview {
  const balance = Math.max(0, Math.round(args.invoiceBalanceCents))
  assertNonNegativeCents(BigInt(balance), "invoiceBalanceCents")

  const settings = args.settings
  const applies =
    settings.passProcessingFeesToCustomer &&
    (settings.feeMode === "customer_pass_through" || settings.feeMode === "customer_partial_pass_through")

  let fee = 0
  if (applies && balance > 0) {
    const pct = Number.isFinite(settings.feePercentageSnapshot) ? Math.max(0, settings.feePercentageSnapshot) : 0
    fee = roundCentsFromPercent(balance, pct)
    if (settings.feeCapCents != null) {
      fee = Math.min(fee, Math.max(0, Math.round(settings.feeCapCents)))
    }
  }

  const disclosure =
    settings.disclosureCopy.trim().length > 0 ? settings.disclosureCopy.trim() : DEFAULT_BLITZPAY_DISCLOSURE_COPY

  return {
    invoiceBalanceCents: balance,
    convenienceFeeCents: fee,
    totalChargeCents: balance + fee,
    appliesToCustomer: applies && fee > 0,
    disclosureCopy: disclosure,
  }
}
