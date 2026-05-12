import type { BlitzpayJournalLineInput } from "@/lib/blitzpay/blitzpay-general-ledger"
import { sortJournalLinesDeterministic } from "@/lib/blitzpay/blitzpay-general-ledger"

/** Bounded list sizes for Phase 3B AP APIs and reporting. */
export const BLITZPAY_AP_VENDOR_LIST_CAP = 100
export const BLITZPAY_AP_BILL_LIST_CAP = 120
export const BLITZPAY_AP_RUN_LIST_CAP = 60
export const BLITZPAY_AP_ALLOC_LIST_CAP = 200
export const BLITZPAY_AP_AGING_VENDOR_CAP = 40
export const BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS = 10_000_00

export function deriveApprovalRequired(totalCents: number, thresholdCents: number = BLITZPAY_AP_APPROVAL_THRESHOLD_CENTS): boolean {
  return Math.round(totalCents) >= Math.max(0, Math.round(thresholdCents))
}

export type ApPaymentAllocationInput = {
  vendorBillId: string
  allocatedAmountCents: number
}

/** Deterministic ordering for pay-run allocations (bill id, then amount). */
export function sortPaymentAllocationsDeterministic(rows: ApPaymentAllocationInput[]): ApPaymentAllocationInput[] {
  return [...rows].sort((a, b) => {
    const c = a.vendorBillId.localeCompare(b.vendorBillId)
    if (c !== 0) return c
    return a.allocatedAmountCents - b.allocatedAmountCents
  })
}

export function assertPurchaseOrderOrgMatch(
  purchaseOrder: { organization_id: string } | null | undefined,
  organizationId: string,
): { ok: true } | { ok: false; reason: "po_org_mismatch" } {
  if (!purchaseOrder) return { ok: true }
  if (purchaseOrder.organization_id !== organizationId) return { ok: false, reason: "po_org_mismatch" }
  return { ok: true }
}

/**
 * Build balanced accrual lines: debit expense bucket lines, credit AP liability for total.
 * Lines are sorted deterministically before return.
 */
export function buildBillAccrualJournalLines(input: {
  lineExpenses: Array<{ expenseAccountId: string; amountCents: number; description?: string | null }>
  accountsPayableAccountId: string
  apCreditDescription?: string
}): BlitzpayJournalLineInput[] {
  const out: BlitzpayJournalLineInput[] = []
  let sumExp = 0
  for (const ln of input.lineExpenses) {
    const n = Math.round(ln.amountCents)
    if (n <= 0) continue
    sumExp += n
    out.push({
      accountId: ln.expenseAccountId,
      lineType: "debit",
      amountCents: n,
      description: ln.description ?? "Vendor bill expense",
    })
  }
  const ap = Math.round(sumExp)
  if (ap <= 0) throw new Error("ap_accrual_zero")
  out.push({
    accountId: input.accountsPayableAccountId,
    lineType: "credit",
    amountCents: ap,
    description: input.apCreditDescription ?? "Accounts payable accrual",
  })
  return sortJournalLinesDeterministic(out)
}

/** Treasury headroom vs approved payables as basis points (0–1_000_000 cap). */
export function computeTreasuryCoverageForPayablesBps(operatingCashCents: number, approvedPayablesCents: number): number {
  const cash = Math.max(0, Math.round(operatingCashCents))
  const due = Math.max(0, Math.round(approvedPayablesCents))
  if (due === 0) return 1_000_000
  return Math.min(1_000_000, Math.round((cash * 10_000) / due))
}

/** 0–100 concentration: largest vendor share of outstanding AP. */
export function computeVendorConcentrationRisk0to100(vendorOutstandingCents: number[]): number {
  const vals = vendorOutstandingCents.map((v) => Math.max(0, Math.round(v))).filter((v) => v > 0)
  if (!vals.length) return 0
  const total = vals.reduce((s, v) => s + v, 0)
  if (total <= 0) return 0
  const maxV = Math.max(...vals)
  return Math.min(100, Math.round((maxV * 100) / total))
}

/**
 * Simple 0–100 score: high when overdue share is low and treasury coverage is comfortable.
 */
export function computePayableAgingHealthScore0to100(input: {
  overdueCents: number
  totalOpenCents: number
  treasuryCoverageBps: number
}): number {
  const overdue = Math.max(0, Math.round(input.overdueCents))
  const open = Math.max(0, Math.round(input.totalOpenCents))
  const overdueRatio = open === 0 ? 0 : overdue / open
  const overduePenalty = Math.min(70, Math.round(overdueRatio * 100))
  const cov = Math.min(1, input.treasuryCoverageBps / 20_000)
  const treasuryBoost = Math.round(cov * 30)
  return Math.max(0, Math.min(100, 100 - overduePenalty + treasuryBoost))
}

/** 0–100 heuristic favoring coverage and dilution of near-term payables. */
export function computeApCashOptimizationScore0to100(input: {
  treasuryCoverageBps: number
  due7dCents: number
  operatingCashCents: number
}): number {
  const cov = Math.min(1, input.treasuryCoverageBps / 25_000)
  const near = Math.max(0, Math.round(input.due7dCents))
  const cash = Math.max(0, Math.round(input.operatingCashCents))
  const nearPressure = cash === 0 ? 1 : Math.min(1, near / Math.max(cash, 1))
  const score = Math.round(cov * 55 + (1 - nearPressure) * 45)
  return Math.max(0, Math.min(100, score))
}

export function computeAverageVendorPaymentDaysFromCompletedAllocations(
  rows: Array<{ allocated_at: string | null; metadata?: { bill_due_date?: string } | null }>,
  cap: number,
): number | null {
  const slice = rows.slice(0, Math.max(0, cap)).filter((r) => r.allocated_at)
  if (!slice.length) return null
  let sum = 0
  let n = 0
  for (const r of slice) {
    const due = String(r.metadata?.bill_due_date ?? "").slice(0, 10)
    const paid = String(r.allocated_at ?? "").slice(0, 10)
    if (!due || !paid) continue
    const d0 = new Date(`${due}T12:00:00.000Z`).getTime()
    const d1 = new Date(`${paid}T12:00:00.000Z`).getTime()
    if (!Number.isFinite(d0) || !Number.isFinite(d1)) continue
    const days = Math.max(0, Math.round((d1 - d0) / 86400000))
    sum += days
    n += 1
  }
  if (!n) return null
  return Math.round(sum / n)
}

export function assertAllocationIntegrity(
  allocatedAmountCents: number,
  billRemainingBeforeCents: number,
): { ok: true } | { ok: false; reason: string } {
  const a = Math.round(allocatedAmountCents)
  const r = Math.round(billRemainingBeforeCents)
  if (a <= 0) return { ok: false, reason: "non_positive_allocation" }
  if (a > r) return { ok: false, reason: "allocation_exceeds_remaining" }
  return { ok: true }
}
