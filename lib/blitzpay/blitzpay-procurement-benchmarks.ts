import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type BlitzpayPhase5bReportingExtension = {
  supplierNetworkParticipationScore: number
  procurementBenchmarkScore: number
  preferredPricingOpportunityCents: number
  bulkPurchaseOpportunityCents: number
  supplierPerformanceHealthScore: number
  rebateCaptureOpportunityScore: number
  vendorFinancingOpportunityScore: number
  supplierNetworkCoverageRate: number
}

export function zeroPhase5bReportingExtension(): BlitzpayPhase5bReportingExtension {
  return {
    supplierNetworkParticipationScore: 0,
    procurementBenchmarkScore: 0,
    preferredPricingOpportunityCents: 0,
    bulkPurchaseOpportunityCents: 0,
    supplierPerformanceHealthScore: 0,
    rebateCaptureOpportunityScore: 0,
    vendorFinancingOpportunityScore: 0,
    supplierNetworkCoverageRate: 0,
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

export type Phase5bBenchmarkRow = { benchmark_score: number | null; benchmark_type?: string }

/** Deterministic aggregate procurement benchmark (0–100) from stored benchmark rows. */
export function averageProcurementBenchmarkScore0to100(rows: ReadonlyArray<Phase5bBenchmarkRow>): number | null {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => String(a.benchmark_type ?? "").localeCompare(String(b.benchmark_type ?? "")))
  let sum = 0
  let n = 0
  for (const r of sorted) {
    if (r.benchmark_score == null) continue
    sum += clampInt(r.benchmark_score, 0, 100)
    n += 1
  }
  if (!n) return null
  return clampInt(sum / n, 0, 100)
}

/** Fallback procurement benchmark from org-local Phase 3E reporting fields only (bounded). */
export function procurementBenchmarkFromLocalSnapshot0to100(s: Pick<BlitzpayOrgReportingSnapshot, "procurementTreasuryImpactScore" | "inventoryTurnoverScore" | "inventoryMarginHealthScore">): number {
  const a = clampInt(s.procurementTreasuryImpactScore, 0, 100)
  const b = clampInt(s.inventoryTurnoverScore, 0, 100)
  const c = clampInt(s.inventoryMarginHealthScore, 0, 100)
  return clampInt(Math.round((a + b + c) / 3), 0, 100)
}

/**
 * Merge Phase 5B reporting extension from org snapshot + bounded aggregate context.
 * Integer math only; no cross-org raw purchasing rows.
 */
export function mergePhase5bFromAggregateContext(
  snapshot: Pick<
    BlitzpayOrgReportingSnapshot,
    | "rebateOpportunityCents"
    | "totalInventoryValueCents"
    | "procurementTreasuryImpactScore"
    | "inventoryTurnoverScore"
    | "inventoryMarginHealthScore"
    | "reorderExposureCents"
  >,
  ctx: {
    visibleNetworkCount: number
    activeMembershipRows: number
    benchmarkRows: ReadonlyArray<Phase5bBenchmarkRow>
    preferredPricingOpportunityCents: number
    bulkPurchaseOpportunityCents: number
    supplierPerformanceAvg0to100: number | null
    vendorFinancingCapacityCentsSum: number
  },
): BlitzpayPhase5bReportingExtension {
  const benchDb = averageProcurementBenchmarkScore0to100(ctx.benchmarkRows)
  const procurementBenchmarkScore =
    benchDb != null ? benchDb : procurementBenchmarkFromLocalSnapshot0to100(snapshot)

  const participation = clampInt(ctx.activeMembershipRows * 12 + ctx.visibleNetworkCount * 15, 0, 100)
  const coverage = clampInt(ctx.visibleNetworkCount * 22 + ctx.activeMembershipRows * 5, 0, 100)

  const rebateCents = Math.max(0, Math.round(snapshot.rebateOpportunityCents))
  const invCents = Math.max(0, Math.round(snapshot.totalInventoryValueCents))
  const rebateCaptureOpportunityScore =
    invCents <= 0 ? clampInt(rebateCents > 0 ? 40 : 0, 0, 100) : clampInt(Math.round((rebateCents * 100) / Math.min(invCents, 10_000_000)), 0, 100)

  const finCap = Math.max(0, Math.round(ctx.vendorFinancingCapacityCentsSum))
  const vendorFinancingOpportunityScore = clampInt(Math.round(finCap / 100_000), 0, 100)

  const perf = ctx.supplierPerformanceAvg0to100 != null ? clampInt(ctx.supplierPerformanceAvg0to100, 0, 100) : procurementBenchmarkScore

  return {
    supplierNetworkParticipationScore: participation,
    procurementBenchmarkScore,
    preferredPricingOpportunityCents: Math.max(0, Math.round(ctx.preferredPricingOpportunityCents)),
    bulkPurchaseOpportunityCents: Math.max(0, Math.round(ctx.bulkPurchaseOpportunityCents)),
    supplierPerformanceHealthScore: perf,
    rebateCaptureOpportunityScore,
    vendorFinancingOpportunityScore,
    supplierNetworkCoverageRate: coverage,
  }
}
