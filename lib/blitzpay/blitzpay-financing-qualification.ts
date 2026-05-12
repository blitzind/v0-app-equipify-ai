/**
 * Deterministic financing qualification (Phase 3D) — operational heuristics only.
 * No bureau data; no AI; bounded integer math.
 */

export type FinancingQualificationInputs = {
  recurringRevenueProxyCents: number
  invoicePaidCountWindow: number
  collectionHealthScore0to100: number
  membershipRenewalSuccessProxyPct: number
  treasuryCoverageBps: number
}

/** Weighted 0–100 score; inputs should already be bounded by caller. */
export function computeFinancingQualificationScore0to100(i: FinancingQualificationInputs): number {
  const rr = Math.min(30, Math.round(Math.min(1, i.recurringRevenueProxyCents / Math.max(1, 500_000)) * 30))
  const inv = Math.min(25, Math.min(i.invoicePaidCountWindow, 25))
  const coll = Math.min(20, Math.round((Math.max(0, Math.min(100, i.collectionHealthScore0to100)) * 20) / 100))
  const mem = Math.min(15, Math.round((Math.max(0, Math.min(100, i.membershipRenewalSuccessProxyPct)) * 15) / 100))
  const tre = Math.min(10, Math.round((Math.max(0, Math.min(1_000_000, i.treasuryCoverageBps)) * 10) / 1_000_000))
  return Math.max(0, Math.min(100, rr + inv + coll + mem + tre))
}

export function passesQualificationThreshold(score: number, threshold: number): boolean {
  return Math.round(score) >= Math.max(0, Math.min(100, Math.round(threshold)))
}
