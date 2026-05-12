import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type BlitzpaySharedBenchmarkType =
  | "collections"
  | "payroll"
  | "memberships"
  | "financing"
  | "procurement"
  | "inventory"
  | "treasury"
  | "revenue"

const BENCHMARK_DIMENSIONS: ReadonlyArray<BlitzpaySharedBenchmarkType> = [
  "collections",
  "payroll",
  "memberships",
  "financing",
  "procurement",
  "inventory",
  "treasury",
  "revenue",
]

/** True when any linked org shows a bounded non-zero signal for the dimension (aggregate-only). */
export function isBenchmarkDimensionCovered(
  snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>,
  dim: BlitzpaySharedBenchmarkType,
): boolean {
  for (const s of snapshots) {
    switch (dim) {
      case "collections":
        if (Math.round(s.collectionSuccessRate) > 0) return true
        break
      case "payroll":
        if (Math.round(s.payrollPressureScore) > 0 || Math.round(s.payrollLiabilityCents) > 0) return true
        break
      case "memberships":
        if (Math.round(s.annualRecurringRevenueCents) > 0 || Math.round(s.recurringRevenueCents) > 0) return true
        break
      case "financing":
        if (Math.round(s.financingRiskScore) > 0 || Math.round(s.contractorAdvanceExposure) > 0) return true
        break
      case "procurement":
        if (Math.round(s.procurementEfficiencyScore) > 0 || Math.round(s.reorderExposureCents) > 0) return true
        break
      case "inventory":
        if (Math.round(s.totalInventoryValueCents) > 0) return true
        break
      case "treasury":
        if (Math.round(s.treasuryPressureScore) > 0 || Math.round(s.treasuryReserveExposureCents) > 0) return true
        break
      case "revenue":
        if (Math.round(s.netCollectedCents) > 0 || Math.round(s.invoiceStylePaymentCapturedCents) > 0) return true
        break
      default:
        break
    }
  }
  return false
}

/** 0–100: share of the eight benchmark dimensions with coverage across linked orgs. */
export function computeSharedBenchmarkCoverage0to100(snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>): number {
  if (!snapshots.length) return 0
  let covered = 0
  for (const dim of BENCHMARK_DIMENSIONS) {
    if (isBenchmarkDimensionCovered(snapshots, dim)) covered += 1
  }
  return Math.min(100, Math.max(0, Math.round((covered * 100) / BENCHMARK_DIMENSIONS.length)))
}

/** Deterministic supporting_metrics object for persistence / APIs (no customer ids). */
export function buildSharedBenchmarkSupportingMetrics(
  snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>,
): Record<string, number> {
  let composite = 0
  for (const s of snapshots) {
    composite += Math.round(s.aiFinancialRiskScore)
    composite += Math.round(s.treasuryPressureScore)
    composite += Math.round(s.collectionSuccessRate)
  }
  return {
    snapshot_count: snapshots.length,
    composite_signal_sum: composite,
  }
}
