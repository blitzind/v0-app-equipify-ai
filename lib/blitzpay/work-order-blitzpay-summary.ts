import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import {
  computeInvoicePaymentAllocation,
  formatPaymentMethodDb,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"

export function blitzpayDisplayPaymentReference(ref: string | null | undefined): string {
  if (ref == null) return ""
  const s = String(ref)
  if (s.startsWith("blitzpay_pi:")) return "Hosted checkout"
  if (s.startsWith("blitzpay_wallet:")) return "Wallet credit"
  if (s.startsWith("blitzpay:")) return "BlitzPay"
  return "Recorded payment"
}

export type WorkOrderBlitzpaySummary = {
  workOrderId: string
  customerId: string
  fieldInvoiceLaterAt: string | null
  invoices: Array<{
    id: string
    invoiceNumber: string
    statusLabel: string
    totalDueCents: number
    balanceDueCents: number
    allocationState: string
  }>
  quotes: Array<{
    id: string
    quoteNumber: string
    status: string
    amountCents: number
    depositCollectedCents: number
    financingReady: boolean
  }>
  wallet: { spendableCreditCents: number; refundableCreditCents: number } | null
  paymentPlans: Array<{
    id: string
    status: string
    planKind: string
    totalTargetCents: number
    paidInstallmentsCents: number
    workOrderId: string | null
    anchoredInvoiceId: string | null
    anchoredQuoteId: string | null
  }>
  recentPayments: Array<{
    id: string
    invoiceId: string
    invoiceNumber: string
    amountCents: number
    paidOn: string
    methodLabel: string
    displayReference: string
  }>
  paymentLinks: Array<{
    id: string
    invoiceId: string
    invoiceNumber: string
    status: string
    createdAt: string
    lastUsedAt: string | null
    useCount: number
  }>
  financingSessionCount: number
}

export async function fetchWorkOrderBlitzpaySummary(
  admin: SupabaseClient,
  organizationId: string,
  workOrderId: string,
): Promise<WorkOrderBlitzpaySummary | null> {
  assertUuid(organizationId, "organizationId")
  assertUuid(workOrderId, "workOrderId")

  const { data: wo, error: woErr } = await admin
    .from("work_orders")
    .select("id, customer_id, blitzpay_field_invoice_later_at")
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
    .maybeSingle()
  if (woErr || !wo) return null
  const customerId = String((wo as { customer_id: string }).customer_id ?? "")
  const fieldInvoiceLaterAt =
    (wo as { blitzpay_field_invoice_later_at?: string | null }).blitzpay_field_invoice_later_at ?? null

  const [{ data: linkRows }, { data: directInv }] = await Promise.all([
    admin
      .from("invoice_work_order_links")
      .select("invoice_id")
      .eq("organization_id", organizationId)
      .eq("work_order_id", workOrderId),
    admin.from("org_invoices").select("id").eq("organization_id", organizationId).eq("work_order_id", workOrderId),
  ])
  const invoiceIds = new Set<string>()
  for (const r of (linkRows ?? []) as Array<{ invoice_id: string }>) {
    if (r.invoice_id) invoiceIds.add(r.invoice_id)
  }
  for (const r of (directInv ?? []) as Array<{ id: string }>) {
    if (r.id) invoiceIds.add(r.id)
  }
  const invList = [...invoiceIds]

  const { data: quoteRows } = await admin
    .from("org_quotes")
    .select(
      "id, quote_number, status, amount_cents, blitzpay_deposit_collected_cents, blitzpay_financing_ready, work_order_id",
    )
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
    .is("archived_at", null)

  const quotes =
    (quoteRows ?? []).map((q) => {
      const row = q as {
        id: string
        quote_number: string
        status: string
        amount_cents: number
        blitzpay_deposit_collected_cents?: number | null
        blitzpay_financing_ready?: boolean | null
      }
      return {
        id: row.id,
        quoteNumber: row.quote_number,
        status: row.status,
        amountCents: Math.round(Number(row.amount_cents) || 0),
        depositCollectedCents: Math.max(0, Math.round(Number(row.blitzpay_deposit_collected_cents ?? 0))),
        financingReady: Boolean(row.blitzpay_financing_ready),
      }
    }) ?? []

  const quoteIds = quotes.map((q) => q.id)

  let invoices: WorkOrderBlitzpaySummary["invoices"] = []
  if (invList.length > 0) {
    const { data: invs } = await admin
      .from("org_invoices")
      .select("id, invoice_number, status, amount_cents, tax_amount_cents")
      .eq("organization_id", organizationId)
      .in("id", invList)
    const { data: payRows } = await admin
      .from("org_invoice_payments")
      .select("invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("invoice_id", invList)
    const payByInv = new Map<string, number>()
    for (const p of (payRows ?? []) as Array<{ invoice_id: string; amount_cents: number }>) {
      const id = p.invoice_id
      payByInv.set(id, (payByInv.get(id) ?? 0) + Math.round(Number(p.amount_cents)))
    }
    const { data: refRows } = await admin
      .from("blitzpay_invoice_refunds")
      .select("org_invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invList)
      .eq("status", "succeeded")
    const refByInv = new Map<string, number>()
    for (const r of (refRows ?? []) as Array<{ org_invoice_id: string; amount_cents: number }>) {
      const id = r.org_invoice_id
      refByInv.set(id, (refByInv.get(id) ?? 0) + Math.round(Number(r.amount_cents)))
    }
    invoices =
      (invs ?? []).map((raw) => {
        const inv = raw as {
          id: string
          invoice_number: string
          status: string
          amount_cents: number
          tax_amount_cents?: number | null
        }
        const totalDue = invoiceGrandTotalCents(inv)
        const gross = payByInv.get(inv.id) ?? 0
        const ref = refByInv.get(inv.id) ?? 0
        const netPaid = Math.max(0, gross - ref)
        const alloc = computeInvoicePaymentAllocation({
          invoiceTotalCents: totalDue,
          paymentsTotalCents: netPaid,
          dbInvoiceStatus: String(inv.status || ""),
        })
        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          statusLabel: invoiceStatusDbToUi(String(inv.status || "")),
          totalDueCents: totalDue,
          balanceDueCents: Math.max(0, alloc.balanceDueCents),
          allocationState: alloc.allocationState,
        }
      }) ?? []
  }

  const planIdSet = new Set<string>()
  const { data: plansByWo } = await admin
    .from("blitzpay_payment_plans")
    .select("id, status, plan_kind, total_target_cents, org_invoice_id, org_quote_id, work_order_id")
    .eq("organization_id", organizationId)
    .eq("work_order_id", workOrderId)
  for (const p of plansByWo ?? []) planIdSet.add((p as { id: string }).id)
  if (invList.length) {
    const { data: plansByInv } = await admin
      .from("blitzpay_payment_plans")
      .select("id, status, plan_kind, total_target_cents, org_invoice_id, org_quote_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invList)
    for (const p of plansByInv ?? []) planIdSet.add((p as { id: string }).id)
  }
  if (quoteIds.length) {
    const { data: plansByQuote } = await admin
      .from("blitzpay_payment_plans")
      .select("id, status, plan_kind, total_target_cents, org_invoice_id, org_quote_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("org_quote_id", quoteIds)
    for (const p of plansByQuote ?? []) planIdSet.add((p as { id: string }).id)
  }

  const paymentPlans: WorkOrderBlitzpaySummary["paymentPlans"] = []
  if (planIdSet.size > 0) {
    const ids = [...planIdSet]
    const { data: planRows } = await admin
      .from("blitzpay_payment_plans")
      .select("id, status, plan_kind, total_target_cents, org_invoice_id, org_quote_id, work_order_id")
      .eq("organization_id", organizationId)
      .in("id", ids)
    const { data: instAgg } = await admin
      .from("blitzpay_payment_plan_installments")
      .select("payment_plan_id, paid_cents")
      .in("payment_plan_id", ids)
    const paidByPlan = new Map<string, number>()
    for (const row of (instAgg ?? []) as Array<{ payment_plan_id: string; paid_cents: number }>) {
      const pid = row.payment_plan_id
      paidByPlan.set(pid, (paidByPlan.get(pid) ?? 0) + Math.max(0, Math.round(Number(row.paid_cents))))
    }
    for (const raw of planRows ?? []) {
      const p = raw as {
        id: string
        status: string
        plan_kind: string
        total_target_cents: number
        org_invoice_id: string | null
        org_quote_id: string | null
        work_order_id: string | null
      }
      paymentPlans.push({
        id: p.id,
        status: p.status,
        planKind: p.plan_kind,
        totalTargetCents: Math.round(Number(p.total_target_cents) || 0),
        paidInstallmentsCents: paidByPlan.get(p.id) ?? 0,
        workOrderId: p.work_order_id,
        anchoredInvoiceId: p.org_invoice_id,
        anchoredQuoteId: p.org_quote_id,
      })
    }
  }

  let wallet: WorkOrderBlitzpaySummary["wallet"] = null
  if (customerId) {
    const { data: w } = await admin
      .from("blitzpay_customer_wallets")
      .select("available_credit_cents, refundable_credit_cents")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .maybeSingle()
    if (w) {
      const row = w as { available_credit_cents?: number; refundable_credit_cents?: number }
      wallet = {
        spendableCreditCents: Math.max(0, Math.round(Number(row.available_credit_cents ?? 0))),
        refundableCreditCents: Math.max(0, Math.round(Number(row.refundable_credit_cents ?? 0))),
      }
    }
  }

  const invNumberById = new Map(invoices.map((i) => [i.id, i.invoiceNumber]))

  let recentPayments: WorkOrderBlitzpaySummary["recentPayments"] = []
  if (invList.length) {
    const { data: rp } = await admin
      .from("org_invoice_payments")
      .select("id, invoice_id, amount_cents, paid_on, payment_method, reference")
      .eq("organization_id", organizationId)
      .in("invoice_id", invList)
      .order("paid_on", { ascending: false })
      .limit(12)
    recentPayments =
      (rp ?? []).map((r) => {
        const row = r as {
          id: string
          invoice_id: string
          amount_cents: number
          paid_on: string
          payment_method: string
          reference: string | null
        }
        return {
          id: row.id,
          invoiceId: row.invoice_id,
          invoiceNumber: invNumberById.get(row.invoice_id) ?? "—",
          amountCents: Math.round(Number(row.amount_cents)),
          paidOn: row.paid_on,
          methodLabel: formatPaymentMethodDb(String(row.payment_method || "other")),
          displayReference: blitzpayDisplayPaymentReference(row.reference),
        }
      }) ?? []
  }

  let paymentLinks: WorkOrderBlitzpaySummary["paymentLinks"] = []
  if (invList.length) {
    const { data: lk } = await admin
      .from("blitzpay_payment_links")
      .select("id, org_invoice_id, status, created_at, last_used_at, use_count")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invList)
      .order("created_at", { ascending: false })
      .limit(12)
    paymentLinks =
      (lk ?? []).map((r) => {
        const row = r as {
          id: string
          org_invoice_id: string
          status: string
          created_at: string
          last_used_at: string | null
          use_count: number
        }
        return {
          id: row.id,
          invoiceId: row.org_invoice_id,
          invoiceNumber: invNumberById.get(row.org_invoice_id) ?? "—",
          status: row.status,
          createdAt: row.created_at,
          lastUsedAt: row.last_used_at,
          useCount: Math.round(Number(row.use_count ?? 0)),
        }
      }) ?? []
  }

  let financingSessionCount = 0
  if (invList.length) {
    const { count, error } = await admin
      .from("blitzpay_financing_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("org_invoice_id", invList)
    if (!error && count != null) financingSessionCount += count
  }
  if (quoteIds.length) {
    const { count, error } = await admin
      .from("blitzpay_financing_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("org_quote_id", quoteIds)
    if (!error && count != null) financingSessionCount += count
  }

  return {
    workOrderId,
    customerId,
    fieldInvoiceLaterAt: fieldInvoiceLaterAt,
    invoices,
    quotes,
    wallet,
    paymentPlans,
    recentPayments,
    paymentLinks,
    financingSessionCount,
  }
}
