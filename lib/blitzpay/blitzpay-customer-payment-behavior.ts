import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"

const INVOICE_SCAN_LIMIT = 220

function dayDiff(aYmdOrIso: string, bYmdOrIso: string): number {
  const a = Date.parse(`${String(aYmdOrIso).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(bYmdOrIso).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((a - b) / (1000 * 60 * 60 * 24))
}

export type BlitzpayCustomerPaymentBehaviorSummary = {
  invoicesSampled: number
  averageDaysToPayWhenPaid: number | null
  latePaymentRatePct: number
  partialPaymentInvoiceCount: number
  financingSessionsLifetime: number
  financingSessionsFundedOrReleased: number
  /** Top overdue balance concentration: largest single-customer share of overdue balance in sample (0–100). */
  overdueConcentrationTopSharePct: number
  /** Count of distinct customers appearing in overdue sample. */
  overdueCustomersInSample: number
  /** Heuristic buckets (no customer names). */
  likelyDepositBenefit: "low" | "medium" | "high"
  likelyFinancingBenefit: "low" | "medium" | "high"
  trustSignal: "limited_data" | "mixed" | "generally_on_time"
  riskSignal: "low" | "medium" | "high"
  summaryLines: string[]
}

/**
 * Summarized customer payment behavior from bounded invoice reads (no portal, no PI ids).
 */
export async function fetchCustomerPaymentBehaviorSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<BlitzpayCustomerPaymentBehaviorSummary> {
  assertUuid(organizationId, "organizationId")

  const { data: invs, error } = await admin
    .from("org_invoices")
    .select("id, customer_id, status, amount_cents, tax_amount_cents, due_date, paid_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(INVOICE_SCAN_LIMIT)
  if (error) throw new Error(error.message)

  const rows = (invs ?? []) as Array<{
    id: string
    customer_id: string | null
    status: string
    amount_cents: number
    tax_amount_cents: number | null
    due_date: string | null
    paid_at: string | null
  }>

  const ids = rows.map((r) => r.id)
  const payBy = new Map<string, number>()
  if (ids.length > 0) {
    const chunk = 80
    for (let i = 0; i < ids.length; i += chunk) {
      const slice = ids.slice(i, i + chunk)
      const { data: pays, error: pErr } = await admin
        .from("org_invoice_payments")
        .select("invoice_id, amount_cents")
        .eq("organization_id", organizationId)
        .in("invoice_id", slice)
      if (pErr) throw new Error(pErr.message)
      for (const p of pays ?? []) {
        const row = p as { invoice_id: string; amount_cents: number }
        payBy.set(row.invoice_id, (payBy.get(row.invoice_id) ?? 0) + Math.round(Number(row.amount_cents)))
      }
    }
  }

  let delaySum = 0
  let delayCount = 0
  let latePaid = 0
  let paidCount = 0
  let partialPaymentInvoiceCount = 0

  const today = new Date().toISOString().slice(0, 10)
  const overdueBalanceByCustomer = new Map<string, number>()

  for (const inv of rows) {
    const total = invoiceGrandTotalCents(inv)
    const gross = payBy.get(inv.id) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: total,
      paymentsTotalCents: gross,
      dbInvoiceStatus: String(inv.status || ""),
    })
    const bal = Math.max(0, alloc.balanceDueCents)
    const st = String(inv.status || "").toLowerCase()

    if (bal > 0 && bal < total && st !== "void") {
      partialPaymentInvoiceCount += 1
    }

    if (st === "paid" && inv.paid_at && inv.due_date) {
      paidCount += 1
      const d = dayDiff(inv.paid_at, inv.due_date)
      delaySum += d
      delayCount += 1
      if (d > 0) latePaid += 1
    }

    if (inv.due_date && inv.due_date < today && bal > 0 && st !== "paid" && st !== "void") {
      const cid = String(inv.customer_id ?? "unknown")
      overdueBalanceByCustomer.set(cid, (overdueBalanceByCustomer.get(cid) ?? 0) + bal)
    }
  }

  const averageDaysToPayWhenPaid = delayCount > 0 ? Math.round((delaySum / delayCount) * 10) / 10 : null
  const latePaymentRatePct = paidCount === 0 ? 0 : Math.round((latePaid / paidCount) * 1000) / 10

  let financingSessionsLifetime = 0
  let financingSessionsFundedOrReleased = 0
  try {
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      admin.from("blitzpay_financing_sessions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
      admin
        .from("blitzpay_financing_sessions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["funded", "payout_released"]),
    ])
    if (c1 != null) financingSessionsLifetime = c1
    if (c2 != null) financingSessionsFundedOrReleased = c2
  } catch {
    /* optional table */
  }

  let overdueTotal = 0
  let top = 0
  for (const v of overdueBalanceByCustomer.values()) {
    overdueTotal += v
    top = Math.max(top, v)
  }
  const overdueConcentrationTopSharePct =
    overdueTotal <= 0 ? 0 : Math.min(100, Math.round((top / overdueTotal) * 1000) / 10)
  const overdueCustomersInSample = overdueBalanceByCustomer.size

  const lateRate = latePaymentRatePct
  const likelyDepositBenefit: BlitzpayCustomerPaymentBehaviorSummary["likelyDepositBenefit"] =
    lateRate >= 25 || overdueConcentrationTopSharePct >= 45 ? "high" : lateRate >= 12 ? "medium" : "low"
  const likelyFinancingBenefit: BlitzpayCustomerPaymentBehaviorSummary["likelyFinancingBenefit"] =
    financingSessionsLifetime >= 8
      ? "high"
      : financingSessionsLifetime >= 3 || (averageDaysToPayWhenPaid != null && averageDaysToPayWhenPaid > 7)
        ? "medium"
        : "low"
  const trustSignal: BlitzpayCustomerPaymentBehaviorSummary["trustSignal"] =
    paidCount < 5 ? "limited_data" : lateRate <= 8 ? "generally_on_time" : "mixed"
  const riskSignal: BlitzpayCustomerPaymentBehaviorSummary["riskSignal"] =
    overdueConcentrationTopSharePct >= 55 || lateRate >= 30 ? "high" : lateRate >= 15 ? "medium" : "low"

  const summaryLines: string[] = []
  if (averageDaysToPayWhenPaid != null) {
    summaryLines.push(`Paid invoices in the sample pay on average ${averageDaysToPayWhenPaid} day(s) versus due date (negative means early).`)
  }
  if (overdueConcentrationTopSharePct >= 35 && overdueCustomersInSample > 0) {
    summaryLines.push(
      `Roughly ${overdueConcentrationTopSharePct}% of overdue balance in the sample sits with a single customer account — worth reviewing terms and follow-up cadence.`,
    )
  }
  if (financingSessionsFundedOrReleased > 0) {
    summaryLines.push(
      `${financingSessionsFundedOrReleased} financing session(s) reached funded or released — financing is in active use for larger tickets.`,
    )
  }
  if (partialPaymentInvoiceCount > 0) {
    summaryLines.push(`${partialPaymentInvoiceCount} invoice(s) in the sample still show a partial payment balance.`)
  }

  return {
    invoicesSampled: rows.length,
    averageDaysToPayWhenPaid,
    latePaymentRatePct,
    partialPaymentInvoiceCount,
    financingSessionsLifetime,
    financingSessionsFundedOrReleased,
    overdueConcentrationTopSharePct,
    overdueCustomersInSample,
    likelyDepositBenefit,
    likelyFinancingBenefit,
    trustSignal,
    riskSignal,
    summaryLines,
  }
}
