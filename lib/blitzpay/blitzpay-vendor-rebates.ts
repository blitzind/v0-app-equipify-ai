/**
 * BlitzPay Phase 3E — vendor rebate accrual math (accrual tracking only; no remittance).
 */

import { divTowardZero } from "@/lib/blitzpay/blitzpay-inventory-finance"

export function estimateRebateAccrualCents(params: {
  rebateType: "percentage" | "volume" | "tiered" | "fixed"
  rebateBasisPoints: number | null
  /** Net bill amount eligible for rebate (cents). */
  basisAmountCents: bigint
  rebateThresholdCents: bigint | null
}): bigint {
  const basis = params.basisAmountCents < 0n ? 0n : params.basisAmountCents
  const thr = params.rebateThresholdCents == null || params.rebateThresholdCents < 0n ? 0n : params.rebateThresholdCents
  if (basis < thr) return 0n
  const bps = params.rebateBasisPoints == null ? 0 : Math.max(0, Math.min(10_000, Math.round(params.rebateBasisPoints)))
  if (params.rebateType === "fixed") {
    const cents = BigInt(Math.max(0, bps))
    return basis > 0n ? (cents > basis ? basis : cents) : 0n
  }
  if (params.rebateType === "percentage" || params.rebateType === "volume" || params.rebateType === "tiered") {
    return divTowardZero(basis * BigInt(bps), 10000n)
  }
  return 0n
}

export function sumEstimatedAnnualRebateCents(rows: readonly { estimatedAnnualRebateCents: number | null }[], cap: number): bigint {
  let s = 0n
  let i = 0
  for (const r of rows) {
    if (i++ >= cap) break
    const v = r.estimatedAnnualRebateCents
    if (v == null || !Number.isFinite(v)) continue
    const b = BigInt(Math.max(0, Math.round(v)))
    s += b
    if (s > 9223372036854775807n) return 9223372036854775807n
  }
  return s
}
