/**
 * Invoicing Phase 3 — Invoice aging helpers.
 *
 * Pure, deterministic rollups over `AdminInvoice[]`. Reused by:
 *   - the customer detail Billing tab (single-customer aging)
 *   - the parent rollup card (consolidated children aging)
 *
 * Aging rules align with the existing Phase 1/2 conventions:
 *   - "Open" = `Sent` or `Unpaid` or `Overdue` (anything that owes payment).
 *   - "Draft / pending" = `Draft` (not yet sent).
 *   - "Overdue" = explicitly status = `Overdue` OR (open + due before today).
 *   - "Paid last 12 months" — by `paidDate`, falling back to `issueDate`.
 *
 * No DB calls — every function is sync. Use the repository's existing
 * `fetchInvoicesForOrganization()` to source data.
 */

import type { AdminInvoice } from "@/lib/mock-data"

export type InvoiceAgingBuckets = {
  /** 0–30 days past due (cents). */
  current: number
  bucket0_30: number
  bucket31_60: number
  bucket61_90: number
  bucket90Plus: number
}

export type InvoiceAgingSummary = {
  /** Counts by status group. */
  unpaidCount: number
  overdueCount: number
  draftPendingCount: number
  paidLast12moCount: number
  totalCount: number
  /** Cents totals (we keep currency math in cents to stay precise). */
  openBalanceCents: number
  overdueBalanceCents: number
  draftPendingBalanceCents: number
  paidLast12moBalanceCents: number
  /** Aging buckets for *open* invoices. */
  buckets: InvoiceAgingBuckets
  /** Most recently issued open invoice (to surface "oldest unpaid" hints). */
  oldestOpenIssueDate: string | null
  /** Most recent paid date in the trailing window (UI hint). */
  newestPaidDate: string | null
}

const ZERO_BUCKETS: InvoiceAgingBuckets = {
  current: 0,
  bucket0_30: 0,
  bucket31_60: 0,
  bucket61_90: 0,
  bucket90Plus: 0,
}

/**
 * Compute days between today (UTC) and a YYYY-MM-DD date string. Positive
 * means the invoice's due date is in the past. Returns 0 for missing input.
 */
function daysSinceDue(due: string | null | undefined): number {
  if (!due) return 0
  const t = new Date(due.length <= 10 ? `${due}T12:00:00.000Z` : due).getTime()
  if (Number.isNaN(t)) return 0
  const now = Date.now()
  if (t >= now) return 0
  return Math.floor((now - t) / 86_400_000)
}

function isOpenStatus(status: AdminInvoice["status"]): boolean {
  return status === "Sent" || status === "Unpaid" || status === "Overdue"
}

function asCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

/**
 * Aggregate aging metrics across the supplied invoices. Pass *unfiltered*
 * invoices (archived rows are ignored automatically).
 */
export function summarizeInvoiceAging(invoices: AdminInvoice[]): InvoiceAgingSummary {
  const now = Date.now()
  const twelveMonthsAgo = now - 365 * 86_400_000

  let unpaidCount = 0
  let overdueCount = 0
  let draftPendingCount = 0
  let paidLast12moCount = 0
  let totalCount = 0

  let openBalanceCents = 0
  let overdueBalanceCents = 0
  let draftPendingBalanceCents = 0
  let paidLast12moBalanceCents = 0

  const buckets: InvoiceAgingBuckets = { ...ZERO_BUCKETS }
  let oldestOpenIssueDate: string | null = null
  let newestPaidDate: string | null = null

  for (const inv of invoices) {
    if (inv.isArchived) continue
    totalCount += 1
    const cents = asCents(inv.amount)

    if (inv.status === "Draft") {
      draftPendingCount += 1
      draftPendingBalanceCents += cents
      continue
    }

    if (isOpenStatus(inv.status)) {
      unpaidCount += 1
      openBalanceCents += cents
      if (!oldestOpenIssueDate || (inv.issueDate && inv.issueDate < oldestOpenIssueDate)) {
        oldestOpenIssueDate = inv.issueDate || oldestOpenIssueDate
      }
      const days = daysSinceDue(inv.dueDate)
      const isOverdue = inv.status === "Overdue" || days > 0
      if (isOverdue) {
        overdueCount += 1
        overdueBalanceCents += cents
      }
      if (days <= 0) buckets.current += cents
      else if (days <= 30) buckets.bucket0_30 += cents
      else if (days <= 60) buckets.bucket31_60 += cents
      else if (days <= 90) buckets.bucket61_90 += cents
      else buckets.bucket90Plus += cents
      continue
    }

    if (inv.status === "Paid") {
      const paidIso = inv.paidDate || inv.issueDate
      const paidT = paidIso
        ? new Date(paidIso.length <= 10 ? `${paidIso}T12:00:00.000Z` : paidIso).getTime()
        : NaN
      if (!Number.isNaN(paidT) && paidT >= twelveMonthsAgo) {
        paidLast12moCount += 1
        paidLast12moBalanceCents += cents
        if (!newestPaidDate || (paidIso && paidIso > newestPaidDate)) {
          newestPaidDate = paidIso || newestPaidDate
        }
      }
    }
    // Void invoices are intentionally excluded from every bucket.
  }

  return {
    unpaidCount,
    overdueCount,
    draftPendingCount,
    paidLast12moCount,
    totalCount,
    openBalanceCents,
    overdueBalanceCents,
    draftPendingBalanceCents,
    paidLast12moBalanceCents,
    buckets,
    oldestOpenIssueDate,
    newestPaidDate,
  }
}

/** Combine multiple summaries into one consolidated rollup. */
export function combineInvoiceAgingSummaries(
  summaries: InvoiceAgingSummary[],
): InvoiceAgingSummary {
  const acc: InvoiceAgingSummary = {
    unpaidCount: 0,
    overdueCount: 0,
    draftPendingCount: 0,
    paidLast12moCount: 0,
    totalCount: 0,
    openBalanceCents: 0,
    overdueBalanceCents: 0,
    draftPendingBalanceCents: 0,
    paidLast12moBalanceCents: 0,
    buckets: { ...ZERO_BUCKETS },
    oldestOpenIssueDate: null,
    newestPaidDate: null,
  }
  for (const s of summaries) {
    acc.unpaidCount += s.unpaidCount
    acc.overdueCount += s.overdueCount
    acc.draftPendingCount += s.draftPendingCount
    acc.paidLast12moCount += s.paidLast12moCount
    acc.totalCount += s.totalCount
    acc.openBalanceCents += s.openBalanceCents
    acc.overdueBalanceCents += s.overdueBalanceCents
    acc.draftPendingBalanceCents += s.draftPendingBalanceCents
    acc.paidLast12moBalanceCents += s.paidLast12moBalanceCents
    acc.buckets.current += s.buckets.current
    acc.buckets.bucket0_30 += s.buckets.bucket0_30
    acc.buckets.bucket31_60 += s.buckets.bucket31_60
    acc.buckets.bucket61_90 += s.buckets.bucket61_90
    acc.buckets.bucket90Plus += s.buckets.bucket90Plus
    if (s.oldestOpenIssueDate && (!acc.oldestOpenIssueDate || s.oldestOpenIssueDate < acc.oldestOpenIssueDate)) {
      acc.oldestOpenIssueDate = s.oldestOpenIssueDate
    }
    if (s.newestPaidDate && (!acc.newestPaidDate || s.newestPaidDate > acc.newestPaidDate)) {
      acc.newestPaidDate = s.newestPaidDate
    }
  }
  return acc
}

/** Convenience: filter the org-wide invoice list to a set of customer ids. */
export function invoicesForCustomerIds(
  all: AdminInvoice[],
  customerIds: Iterable<string>,
): AdminInvoice[] {
  const set = new Set<string>()
  for (const id of customerIds) {
    const t = id?.trim()
    if (t) set.add(t)
  }
  if (set.size === 0) return []
  return all.filter((inv) => inv.customerId && set.has(inv.customerId))
}

/** UI helper — currency formatter aligned with the rest of the app (USD, no fraction). */
export function fmtCentsCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100)
}
