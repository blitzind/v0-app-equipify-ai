/**
 * Deterministic payroll / commission math (Phase 2Y). No DB access — safe for unit tests from plain TS runners.
 */

export type TechnicianCompensationType = "hourly" | "salary" | "commission" | "hybrid"

export type TechnicianCompensationProfileLike = {
  compensationType: TechnicianCompensationType
  /** 0–100 */
  commissionPercentage: number
  flatRateCents: number
  /** Applied to overtime hours portion in hybrid path */
  overtimeMultiplier: number
}

/**
 * Recognized revenue basis for commission: collected cash/credit on the invoice, capped by invoice total,
 * minus an explicit overlap adjustment so callers can avoid double-counting deposits when both sides
 * of the ledger represent the same economic event.
 */
export function calculateWorkOrderRevenueBasis(input: {
  invoiceGrandTotalCents: number
  netPaidCents: number
  /** Caller-supplied overlap (e.g. deposit counted twice across wallet + payment streams). */
  depositDoubleCountOverlapCents?: number
}): number {
  const total = Math.max(0, Math.round(input.invoiceGrandTotalCents))
  const paid = Math.max(0, Math.round(input.netPaidCents))
  const overlap = Math.max(0, Math.round(input.depositDoubleCountOverlapCents ?? 0))
  const adjustedPaid = Math.max(0, paid - Math.min(overlap, paid))
  return Math.min(total, adjustedPaid)
}

export function calculateTechnicianCommission(
  revenueBasisCents: number,
  profile: TechnicianCompensationProfileLike,
): number {
  const basis = Math.max(0, Math.round(revenueBasisCents))
  if (profile.compensationType === "commission" || profile.compensationType === "hybrid") {
    const pct = Math.min(100, Math.max(0, Number(profile.commissionPercentage) || 0))
    return Math.round((basis * pct) / 100)
  }
  return 0
}

export function calculateHybridCompensation(input: {
  regularHours: number
  overtimeHours: number
  revenueBasisCents: number
  profile: TechnicianCompensationProfileLike
}): { hourlyPortionCents: number; overtimePortionCents: number; commissionPortionCents: number; totalCents: number } {
  const rate = Math.max(0, Math.round(input.profile.flatRateCents))
  const mult = Math.max(1, Number(input.profile.overtimeMultiplier) || 1)
  const regH = Math.max(0, Number(input.regularHours) || 0)
  const otH = Math.max(0, Number(input.overtimeHours) || 0)
  const hourlyPortionCents = Math.round(regH * rate)
  const overtimePortionCents = Math.round(otH * rate * mult)
  const commissionPortionCents =
    input.profile.compensationType === "hybrid" || input.profile.compensationType === "commission" ?
      calculateTechnicianCommission(input.revenueBasisCents, input.profile)
    : 0
  const totalCents = hourlyPortionCents + overtimePortionCents + commissionPortionCents
  return { hourlyPortionCents, overtimePortionCents, commissionPortionCents, totalCents }
}

export type CommissionRowLike = {
  technicianUserId: string
  commissionCents: number
  commissionStatus: "pending" | "approved" | "paid" | "void"
}

export function buildPayrollPeriodSummary(rows: CommissionRowLike[]): {
  totalCommissionPendingCents: number
  totalCommissionApprovedCents: number
  totalCommissionPaidCents: number
  technicianIds: string[]
} {
  let pending = 0
  let approved = 0
  let paid = 0
  const tech = new Set<string>()
  for (const r of rows) {
    tech.add(r.technicianUserId)
    if (r.commissionStatus === "pending") pending += Math.max(0, r.commissionCents)
    if (r.commissionStatus === "approved") approved += Math.max(0, r.commissionCents)
    if (r.commissionStatus === "paid") paid += Math.max(0, r.commissionCents)
  }
  return {
    totalCommissionPendingCents: pending,
    totalCommissionApprovedCents: approved,
    totalCommissionPaidCents: paid,
    technicianIds: [...tech].sort(),
  }
}

export function buildTechnicianPayoutBreakdown(
  rows: CommissionRowLike[],
): Array<{ technicianUserId: string; pendingCents: number; approvedCents: number; paidCents: number }> {
  const map = new Map<string, { pendingCents: number; approvedCents: number; paidCents: number }>()
  for (const r of rows) {
    const cur = map.get(r.technicianUserId) ?? { pendingCents: 0, approvedCents: 0, paidCents: 0 }
    const c = Math.max(0, r.commissionCents)
    if (r.commissionStatus === "pending") cur.pendingCents += c
    if (r.commissionStatus === "approved") cur.approvedCents += c
    if (r.commissionStatus === "paid") cur.paidCents += c
    map.set(r.technicianUserId, cur)
  }
  return [...map.entries()]
    .map(([technicianUserId, v]) => ({ technicianUserId, ...v }))
    .sort((a, b) => a.technicianUserId.localeCompare(b.technicianUserId))
}

export function buildCommissionApprovalQueue(
  rows: Array<
    CommissionRowLike & {
      workOrderId: string | null
      orgInvoiceId: string
      revenueBasisCents: number
      calculatedAt: string
    }
  >,
): Array<
  CommissionRowLike & {
    workOrderId: string | null
    orgInvoiceId: string
    revenueBasisCents: number
    calculatedAt: string
  }
> {
  return rows
    .filter((r) => r.commissionStatus === "pending")
    .sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt) || a.orgInvoiceId.localeCompare(b.orgInvoiceId))
}
