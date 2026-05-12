import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export type BlitzpayIntercompanyBalanceRow = {
  balance_amount_cents: number
  balance_status: string
  financial_group_id?: string
  source_organization_id?: string
  target_organization_id?: string
}

/** Sum active inter-company tracking amounts (cents, non-negative). */
export function sumActiveIntercompanyExposureCents(rows: ReadonlyArray<BlitzpayIntercompanyBalanceRow>): number {
  let sum = 0
  for (const r of rows) {
    if (String(r.balance_status) !== "active") continue
    sum += Math.max(0, Math.round(Number(r.balance_amount_cents)))
  }
  return sum
}

/** Lexicographic deterministic ordering for balance rows (stable tie-break). */
export function sortIntercompanyBalancesDeterministic<T extends BlitzpayIntercompanyBalanceRow & { id?: string }>(
  rows: ReadonlyArray<T>,
): T[] {
  return [...rows].sort((a, b) => {
    const ga = String(a.financial_group_id ?? "")
    const gb = String(b.financial_group_id ?? "")
    if (ga !== gb) return ga.localeCompare(gb)
    const sa = String(a.source_organization_id ?? "")
    const sb = String(b.source_organization_id ?? "")
    if (sa !== sb) return sa.localeCompare(sb)
    const ta = String(a.target_organization_id ?? "")
    const tb = String(b.target_organization_id ?? "")
    if (ta !== tb) return ta.localeCompare(tb)
    const ida = String(a.id ?? "")
    const idb = String(b.id ?? "")
    return ida.localeCompare(idb)
  })
}

function treasurySortKey(s: BlitzpayOrgReportingSnapshot): string {
  return [
    String(Math.max(0, Math.round(s.treasuryReserveExposureCents))).padStart(14, "0"),
    String(Math.max(0, Math.round(s.treasuryPendingPayoutTotalsCents))).padStart(14, "0"),
    String(Math.max(0, Math.round(s.treasuryEstimateUpcomingTransferCents))).padStart(14, "0"),
  ].join("|")
}

/**
 * Regional / treasury rollup helper: sum treasury-related cents across org snapshots
 * (deterministic sort — snapshots do not embed org ids).
 */
export function rollupTreasuryExposureCentsFromSnapshots(snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>): number {
  const sorted = [...snapshots].sort((a, b) => treasurySortKey(a).localeCompare(treasurySortKey(b)))
  let total = 0
  for (const s of sorted) {
    total += Math.max(0, Math.round(s.treasuryReserveExposureCents))
    total += Math.max(0, Math.round(s.treasuryPendingPayoutTotalsCents))
    total += Math.max(0, Math.round(s.treasuryEstimateUpcomingTransferCents))
  }
  return total
}

/** Payroll-related rollup (integer cents only). */
export function rollupPayrollExposureCentsFromSnapshots(snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>): number {
  function payrollKey(s: BlitzpayOrgReportingSnapshot): string {
    const a = Math.max(0, Math.round(s.payrollLiabilityCents))
    const b = Math.max(0, Math.round(s.estimatedPayrollBurdenCents))
    const c = Math.max(0, Math.round(s.payrollPendingCommissionCents))
    return `${String(a).padStart(14, "0")}|${String(b).padStart(14, "0")}|${String(c).padStart(14, "0")}`
  }
  const sorted = [...snapshots].sort((a, b) => payrollKey(a).localeCompare(payrollKey(b)))
  let total = 0
  for (const s of sorted) {
    total += Math.max(0, Math.round(s.payrollLiabilityCents))
    total += Math.max(0, Math.round(s.estimatedPayrollBurdenCents))
    total += Math.max(0, Math.round(s.payrollPendingCommissionCents))
  }
  return total
}

/** Procurement / inventory valuation rollup (integer cents). */
export function rollupProcurementInventoryCentsFromSnapshots(snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>): number {
  let total = 0
  for (const s of snapshots) {
    total += Math.max(0, Math.round(s.totalInventoryValueCents))
    total += Math.max(0, Math.round(s.reorderExposureCents))
  }
  return total
}
