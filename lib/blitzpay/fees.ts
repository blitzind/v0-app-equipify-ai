import { assertNonNegativeCents, assertPositiveCents } from "@/lib/blitzpay/money"
import { DEFAULT_BLITZPAY_FEE_POLICY_VERSION } from "@/lib/blitzpay/payment-domain"

export type BlitzpayFeeInputs = {
  /** Charge total in minor units (PI amount). */
  amountCents: bigint
  platformFeeBps: number
  platformFeeFixedCents: number
  convenienceFeeBps?: number
  convenienceFeeFixedCents?: number
}

export type BlitzpayFeeComputation = {
  platformFeeFromBpsCents: bigint
  platformFeeFixedCents: bigint
  convenienceFeeFromBpsCents: bigint
  convenienceFeeFixedCents: bigint
  computedTotalApplicationFeeCents: bigint
  policyVersion: string
}

function assertBps(bps: number, label: string): void {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    throw new Error(`${label} must be an integer between 0 and 10000`)
  }
}

function assertFixedCents(n: number, label: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

/** Basis points on amount: round half away from zero to whole cents. */
export function feeFromBpsRounded(amountCents: bigint, bps: number): bigint {
  assertPositiveCents(amountCents, "amountCents")
  assertBps(bps, "bps")
  if (bps === 0) return 0n
  const numerator = amountCents * BigInt(bps) + 5000n
  return numerator / 10000n
}

/**
 * Computes platform + convenience fee components and total application_fee_amount
 * candidate for Stripe (caller still enforces caps / Stripe rules).
 */
export function computeBlitzpayApplicationFeeBreakdown(input: BlitzpayFeeInputs): BlitzpayFeeComputation {
  assertPositiveCents(input.amountCents, "amountCents")
  assertBps(input.platformFeeBps, "platformFeeBps")
  assertFixedCents(input.platformFeeFixedCents, "platformFeeFixedCents")
  const convBps = input.convenienceFeeBps ?? 0
  const convFixed = input.convenienceFeeFixedCents ?? 0
  assertBps(convBps, "convenienceFeeBps")
  assertFixedCents(convFixed, "convenienceFeeFixedCents")

  const platformFeeFromBpsCents = feeFromBpsRounded(input.amountCents, input.platformFeeBps)
  const platformFeeFixedCents = BigInt(input.platformFeeFixedCents)
  assertNonNegativeCents(platformFeeFixedCents, "platformFeeFixedCents")

  const convenienceFeeFromBpsCents = feeFromBpsRounded(input.amountCents, convBps)
  const convenienceFeeFixedCents = BigInt(convFixed)
  assertNonNegativeCents(convenienceFeeFixedCents, "convenienceFeeFixedCents")

  const computedTotalApplicationFeeCents =
    platformFeeFromBpsCents + platformFeeFixedCents + convenienceFeeFromBpsCents + convenienceFeeFixedCents

  assertNonNegativeCents(computedTotalApplicationFeeCents, "computedTotalApplicationFeeCents")
  if (computedTotalApplicationFeeCents > input.amountCents) {
    throw new Error("computed application fee cannot exceed charge amount")
  }

  return {
    platformFeeFromBpsCents,
    platformFeeFixedCents,
    convenienceFeeFromBpsCents,
    convenienceFeeFixedCents,
    computedTotalApplicationFeeCents,
    policyVersion: DEFAULT_BLITZPAY_FEE_POLICY_VERSION,
  }
}
