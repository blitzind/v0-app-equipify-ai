/**
 * Invoice / payment financial reporting (Phase 39).
 * Uses Phase 38 allocation helpers — no separate ledger.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
  type InvoicePaymentAllocationState,
} from "@/lib/billing/invoice-payment-allocation"

export type FinancialInvoiceWorkflowStatus =
  | "all"
  | "draft"
  | "sent"
  | "unpaid"
  | "paid"
  | "overdue"
  | "void"

export type FinancialPaymentStatusFilter = "all" | InvoicePaymentAllocationState

export type FinancialInvoicesReportParams = {
  from: string
  to: string
  /** When true, only invoices issued in [from, to] are loaded (narrows AR + aging). Default false = recent window by limit. */
  invoicedInPeriodOnly: boolean
  customerId: string | null
  invoiceStatus: FinancialInvoiceWorkflowStatus
  paymentStatus: FinancialPaymentStatusFilter
  includeArchived: boolean
}

export type FinancialInvoicesReportPayload = {
  from: string
  to: string
  asOf: string
  truncated: boolean
  summary: {
    invoiceRowCap: number
    invoicesLoaded: number
    invoicesIssuedInPeriodCount: number
    totalInvoicedInPeriodCents: number
    paymentsInPeriodCents: number
    openBalanceCents: number
    overdueBalanceCents: number
    counts: {
      workflow: Record<string, number>
      allocation: Record<InvoicePaymentAllocationState, number>
    }
  }
  agingBucketsCents: {
    current: number
    d1_30: number
    d31_60: number
    d61_90: number
    d90_plus: number
  }
  customers: Array<{
    customerId: string
    customerName: string
    invoicedInPeriodCents: number
    paidInPeriodCents: number
    openBalanceCents: number
    overdueBalanceCents: number
    invoiceCount: number
  }>
}

const INVOICE_ROW_CAP = 8000

function utcDayMs(isoDate: string): number {
  const d = isoDate.slice(0, 10)
  return new Date(`${d}T12:00:00.000Z`).getTime()
}

/** Calendar days past due when due < asOf; else 0. */
export function daysPastDue(dueDate: string | null | undefined, asOf: string): number {
  if (!dueDate) return 0
  const due = utcDayMs(dueDate)
  const a = utcDayMs(asOf)
  if (due >= a) return 0
  return Math.floor((a - due) / 86_400_000)
}

export function agingBucketForDays(days: number): keyof FinancialInvoicesReportPayload["agingBucketsCents"] {
  if (days <= 0) return "current"
  if (days <= 30) return "d1_30"
  if (days <= 60) return "d31_60"
  if (days <= 90) return "d61_90"
  return "d90_plus"
}

function inClosedDateRange(iso: string | null | undefined, from: string, to: string): boolean {
  if (!iso) return false
  const d = String(iso).slice(0, 10)
  return d >= from && d <= to
}

type InvRow = {
  id: string
  customer_id: string
  invoice_number: string
  amount_cents: number
  tax_amount_cents?: number | null
  status: string
  issued_at: string
  due_date?: string | null
  archived_at?: string | null
}

function matchesWorkflowFilter(status: string, filter: FinancialInvoiceWorkflowStatus): boolean {
  if (filter === "all") return true
  return status === filter
}

function matchesPaymentFilter(
  state: InvoicePaymentAllocationState,
  filter: FinancialPaymentStatusFilter,
): boolean {
  if (filter === "all") return true
  return state === filter
}

function isReceivableRow(status: string): boolean {
  return status !== "void" && status !== "draft"
}

export function financialInvoicesReportToCsv(payload: FinancialInvoicesReportPayload): string[][] {
  const s = payload.summary
  const a = payload.agingBucketsCents
  return [
    ["Equipify invoice financial report", `${payload.from} through ${payload.to}`, `as-of ${payload.asOf}`],
    [],
    ["Metric", "Value (USD)"],
    ["Invoices loaded (cap)", `${s.invoicesLoaded}${payload.truncated ? " (truncated)" : ""}`],
    ["Invoices issued in period (count)", String(s.invoicesIssuedInPeriodCount)],
    ["Total invoiced in period", String(Math.round(s.totalInvoicedInPeriodCents / 100))],
    ["Payments received in period", String(Math.round(s.paymentsInPeriodCents / 100))],
    ["Open balance (receivable)", String(Math.round(s.openBalanceCents / 100))],
    ["Overdue balance", String(Math.round(s.overdueBalanceCents / 100))],
    [],
    ["Aging bucket", "Open balance (USD)"],
    ["Current / not past due", String(Math.round(a.current / 100))],
    ["1–30 days past due", String(Math.round(a.d1_30 / 100))],
    ["31–60 days past due", String(Math.round(a.d31_60 / 100))],
    ["61–90 days past due", String(Math.round(a.d61_90 / 100))],
    ["90+ days past due", String(Math.round(a.d90_plus / 100))],
    [],
    ["Workflow status", "Count"],
    ...Object.entries(s.counts.workflow).map(([k, v]) => [k, String(v)]),
    [],
    ["Payment allocation", "Count"],
    ...Object.entries(s.counts.allocation).map(([k, v]) => [k, String(v)]),
    [],
    ["Customer", "Invoiced (period)", "Paid (period)", "Open balance", "Overdue balance", "Invoice count"],
    ...payload.customers.map((c) => [
      c.customerName,
      String(Math.round(c.invoicedInPeriodCents / 100)),
      String(Math.round(c.paidInPeriodCents / 100)),
      String(Math.round(c.openBalanceCents / 100)),
      String(Math.round(c.overdueBalanceCents / 100)),
      String(c.invoiceCount),
    ]),
  ]
}

export async function computeFinancialInvoicesReport(
  supabase: SupabaseClient,
  organizationId: string,
  params: FinancialInvoicesReportParams,
): Promise<FinancialInvoicesReportPayload> {
  const asOf = new Date().toISOString().slice(0, 10)
  const { from, to, invoicedInPeriodOnly, customerId, invoiceStatus, paymentStatus, includeArchived } = params

  let invQuery = supabase
    .from("org_invoices")
    .select(
      "id, customer_id, invoice_number, amount_cents, tax_amount_cents, status, issued_at, due_date, archived_at",
    )
    .eq("organization_id", organizationId)
    .order("issued_at", { ascending: false })
    .limit(INVOICE_ROW_CAP)

  if (!includeArchived) {
    invQuery = invQuery.is("archived_at", null)
  }
  if (customerId) {
    invQuery = invQuery.eq("customer_id", customerId)
  }
  if (invoicedInPeriodOnly) {
    invQuery = invQuery.gte("issued_at", from).lte("issued_at", to)
  }

  const { data: invData, error: invErr } = await invQuery
  if (invErr) throw new Error(invErr.message)

  const rows = (invData ?? []) as InvRow[]
  const truncated = rows.length >= INVOICE_ROW_CAP

  const invoiceIds = rows.map((r) => r.id)
  const payTotals = new Map<string, number>()
  if (invoiceIds.length > 0) {
    const chunkSize = 200
    for (let i = 0; i < invoiceIds.length; i += chunkSize) {
      const chunk = invoiceIds.slice(i, i + chunkSize)
      const { data: payRows, error: payErr } = await supabase
        .from("org_invoice_payments")
        .select("invoice_id, amount_cents, paid_on")
        .eq("organization_id", organizationId)
        .in("invoice_id", chunk)
      if (payErr) throw new Error(payErr.message)
      for (const p of payRows ?? []) {
        const id = p.invoice_id as string
        payTotals.set(id, (payTotals.get(id) ?? 0) + Math.round(Number(p.amount_cents)))
      }
    }
  }

  let paymentsInPeriodCents = 0
  const { data: periodPayRows, error: periodPayErr } = await supabase
    .from("org_invoice_payments")
    .select("invoice_id, amount_cents, paid_on")
    .eq("organization_id", organizationId)
    .gte("paid_on", from)
    .lte("paid_on", to)

  if (periodPayErr) throw new Error(periodPayErr.message)
  const periodPaymentsByInvoice = new Map<string, number>()
  for (const p of periodPayRows ?? []) {
    const cents = Math.round(Number(p.amount_cents))
    paymentsInPeriodCents += cents
    const iid = p.invoice_id as string
    periodPaymentsByInvoice.set(iid, (periodPaymentsByInvoice.get(iid) ?? 0) + cents)
  }

  const customerIds = [...new Set(rows.map((r) => r.customer_id))]
  const custNames = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: custRows, error: cErr } = await supabase
      .from("customers")
      .select("id, company_name")
      .eq("organization_id", organizationId)
      .in("id", customerIds)
    if (cErr) throw new Error(cErr.message)
    for (const c of custRows ?? []) {
      custNames.set(c.id as string, String((c as { company_name?: string }).company_name ?? "Customer"))
    }
  }

  type Enriched = {
    row: InvRow
    totalDueCents: number
    paidCents: number
    balanceCents: number
    allocation: InvoicePaymentAllocationState
    daysPast: number
  }

  const enriched: Enriched[] = []
  for (const row of rows) {
    const totalDue = invoiceGrandTotalCents(row)
    const sumPay = payTotals.get(row.id) ?? 0
    const alloc = computeInvoicePaymentAllocation({
      invoiceTotalCents: totalDue,
      paymentsTotalCents: sumPay,
      dbInvoiceStatus: row.status,
    })
    const balance = Math.max(0, alloc.balanceDueCents)
    const daysPast = daysPastDue(row.due_date ?? null, asOf)
    enriched.push({
      row,
      totalDueCents: totalDue,
      paidCents: alloc.totalPaidCents,
      balanceCents: balance,
      allocation: alloc.allocationState,
      daysPast,
    })
  }

  const filtered = enriched.filter((e) => {
    if (!matchesWorkflowFilter(e.row.status, invoiceStatus)) return false
    if (!matchesPaymentFilter(e.allocation, paymentStatus)) return false
    return true
  })

  let invoicesIssuedInPeriodCount = 0
  let totalInvoicedInPeriodCents = 0
  for (const e of filtered) {
    if (e.row.status === "void") continue
    if (inClosedDateRange(e.row.issued_at, from, to)) {
      invoicesIssuedInPeriodCount += 1
      totalInvoicedInPeriodCents += e.totalDueCents
    }
  }

  const workflowCounts: Record<string, number> = {}
  const allocationCounts: Record<InvoicePaymentAllocationState, number> = {
    unpaid: 0,
    partial: 0,
    paid: 0,
    overpaid: 0,
  }

  let openBalanceCents = 0
  let overdueBalanceCents = 0
  const aging: FinancialInvoicesReportPayload["agingBucketsCents"] = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
  }

  for (const e of filtered) {
    workflowCounts[e.row.status] = (workflowCounts[e.row.status] ?? 0) + 1
    allocationCounts[e.allocation] += 1

    if (!isReceivableRow(e.row.status)) continue
    if (e.balanceCents <= 0) continue

    openBalanceCents += e.balanceCents
    if (e.daysPast > 0) {
      overdueBalanceCents += e.balanceCents
    }
    const bucket = agingBucketForDays(e.daysPast)
    aging[bucket] += e.balanceCents
  }

  const custAgg = new Map<
    string,
    {
      invoicedInPeriodCents: number
      paidInPeriodCents: number
      openBalanceCents: number
      overdueBalanceCents: number
      invoiceCount: number
    }
  >()

  for (const e of filtered) {
    const cid = e.row.customer_id
    if (!custAgg.has(cid)) {
      custAgg.set(cid, {
        invoicedInPeriodCents: 0,
        paidInPeriodCents: 0,
        openBalanceCents: 0,
        overdueBalanceCents: 0,
        invoiceCount: 0,
      })
    }
    const g = custAgg.get(cid)!
    g.invoiceCount += 1
    if (e.row.status !== "void" && inClosedDateRange(e.row.issued_at, from, to)) {
      g.invoicedInPeriodCents += e.totalDueCents
    }
    if (isReceivableRow(e.row.status) && e.balanceCents > 0) {
      g.openBalanceCents += e.balanceCents
      if (e.daysPast > 0) g.overdueBalanceCents += e.balanceCents
    }
  }

  for (const [iid, cents] of periodPaymentsByInvoice) {
    const inv = rows.find((r) => r.id === iid)
    if (!inv) continue
    const g = custAgg.get(inv.customer_id)
    if (g) g.paidInPeriodCents += cents
  }

  const customers = [...custAgg.entries()]
    .map(([customerIdKey, v]) => ({
      customerId: customerIdKey,
      customerName: custNames.get(customerIdKey) ?? "Customer",
      ...v,
    }))
    .sort((a, b) => b.openBalanceCents - a.openBalanceCents)

  return {
    from,
    to,
    asOf,
    truncated,
    summary: {
      invoiceRowCap: INVOICE_ROW_CAP,
      invoicesLoaded: rows.length,
      invoicesIssuedInPeriodCount,
      totalInvoicedInPeriodCents,
      paymentsInPeriodCents,
      openBalanceCents,
      overdueBalanceCents,
      counts: { workflow: workflowCounts, allocation: allocationCounts },
    },
    agingBucketsCents: aging,
    customers,
  }
}
