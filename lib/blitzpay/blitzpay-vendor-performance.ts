import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type VendorScoreComponents = {
  fulfillment_score: number | null
  pricing_score: number | null
  rebate_score: number | null
  delivery_score: number | null
  support_score: number | null
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/** Deterministic overall 0–100 from nullable sub-scores (equal weight on present components). */
export function computeSupplierOverallScore0to100(c: VendorScoreComponents): number {
  const parts = [c.fulfillment_score, c.pricing_score, c.rebate_score, c.delivery_score, c.support_score].filter(
    (x): x is number => x != null && Number.isFinite(x),
  )
  if (!parts.length) return 0
  let sum = 0
  for (const p of parts) sum += clampInt(p, 0, 100)
  return clampInt(Math.round(sum / parts.length), 0, 100)
}

/** Advisory score from bounded AP/procurement snapshot fields (no vendor-level PII). */
export function estimateSupplierPerformanceFromSnapshot0to100(
  s: Pick<
    BlitzpayOrgReportingSnapshot,
    | "payableAgingHealthScore"
    | "vendorConcentrationRisk"
    | "treasuryCoverageForPayables"
    | "procurementTreasuryImpactScore"
  >,
): number {
  const aging = clampInt(s.payableAgingHealthScore, 0, 100)
  const conc = clampInt(100 - clampInt(s.vendorConcentrationRisk, 0, 100), 0, 100)
  const cov = clampInt(Math.min(100, Math.round(s.treasuryCoverageForPayables / 1000)), 0, 100)
  const proc = clampInt(s.procurementTreasuryImpactScore, 0, 100)
  return clampInt(Math.round((aging + conc + cov + proc) / 4), 0, 100)
}

export function averageOverallScoresDeterministic(scores: ReadonlyArray<{ overall_score: number | null; vendor_id?: string }>): number | null {
  const sorted = [...scores].sort((a, b) => String(a.vendor_id ?? "").localeCompare(String(b.vendor_id ?? "")))
  let sum = 0
  let n = 0
  for (const r of sorted) {
    if (r.overall_score == null) continue
    sum += clampInt(r.overall_score, 0, 100)
    n += 1
  }
  if (!n) return null
  return clampInt(Math.round(sum / n), 0, 100)
}
