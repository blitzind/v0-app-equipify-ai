import type { SupabaseClient } from "@supabase/supabase-js"
import { computeInvoicePaymentAllocation, invoiceGrandTotalCents } from "@/lib/billing/invoice-payment-allocation"
import { normalizeStripeIdColumn } from "@/lib/billing/subscriptions"

/**
 * Subscription states that block hard-delete when a real Stripe subscription id exists.
 * `trialing` is intentionally excluded so trial workspaces can be removed without Stripe churn.
 */
const BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
])

/** Issued / receivable statuses (lowercase DB). Draft/paid/void never block on their own. */
const INVOICE_STATUSES_FOR_BALANCE_CHECK = new Set(["sent", "unpaid", "overdue"])

type OrgInvoiceBalanceRow = {
  id: string
  status: string
  amount_cents: number | null
  tax_amount_cents: number | null
}

function netPaymentsCents(
  payments: Array<{ invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const p of payments) {
    if (p.invoice_id !== invoiceId) continue
    sum += Math.round(Number(p.amount_cents) || 0)
  }
  return sum
}

function netRefundsCents(
  refunds: Array<{ org_invoice_id: string; amount_cents: number | null }>,
  invoiceId: string,
): number {
  let sum = 0
  for (const r of refunds) {
    if (r.org_invoice_id !== invoiceId) continue
    sum += Math.round(Number(r.amount_cents) || 0)
  }
  return sum
}

/**
 * True when this invoice still has a customer balance to collect (matches AR semantics).
 */
export function orgInvoiceBlocksOrganizationDelete(row: OrgInvoiceBalanceRow, paymentsTotalCents: number): boolean {
  const st = String(row.status || "").toLowerCase()
  if (!INVOICE_STATUSES_FOR_BALANCE_CHECK.has(st)) return false

  const invoiceTotalCents = invoiceGrandTotalCents({
    amount_cents: Math.round(Number(row.amount_cents) || 0),
    tax_amount_cents: row.tax_amount_cents,
  })
  if (invoiceTotalCents <= 0) return false

  const { balanceDueCents } = computeInvoicePaymentAllocation({
    invoiceTotalCents,
    paymentsTotalCents,
    dbInvoiceStatus: st,
  })

  return balanceDueCents > 0
}

export function subscriptionBlocksOrganizationDelete(subscription: {
  stripe_subscription_id: string | null | undefined
  status: string | null | undefined
} | null): boolean {
  if (!subscription) return false
  const stripeSub = normalizeStripeIdColumn(subscription.stripe_subscription_id ?? null)
  if (!stripeSub) return false
  const st = String(subscription.status || "").toLowerCase()
  if (st === "trialing") return false
  return BLOCKING_SUBSCRIPTION_STATUSES.has(st)
}

export type OrganizationDeleteGuardResult =
  | { ok: true }
  | { ok: false; httpStatus: 409; error: string; message: string }
  | { ok: false; httpStatus: 500; error: string; message: string }

/**
 * Platform-admin hard delete preflight: paid Stripe states and open AR only.
 */
export async function evaluateOrganizationDeleteGuards(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationDeleteGuardResult> {
  const { data: sub, error: subErr } = await admin
    .from("organization_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (subErr) {
    return { ok: false, httpStatus: 500, error: "subscription_check_failed", message: subErr.message }
  }

  if (subscriptionBlocksOrganizationDelete(sub)) {
    return {
      ok: false,
      httpStatus: 409,
      error: "active_subscription",
      message:
        "Cannot delete: this organization has a billable Stripe subscription (active, past due, unpaid, paused, or incomplete). Cancel in Stripe and sync, or wait until the subscription is trialing/canceled.",
    }
  }

  const { data: invoices, error: invErr } = await admin
    .from("org_invoices")
    .select("id, status, amount_cents, tax_amount_cents")
    .eq("organization_id", organizationId)
    .is("archived_at", null)

  if (invErr) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: invErr.message }
  }

  const rows = (invoices ?? []) as OrgInvoiceBalanceRow[]
  const candidateIds = rows.filter((r) => INVOICE_STATUSES_FOR_BALANCE_CHECK.has(String(r.status || "").toLowerCase())).map((r) => r.id)

  if (candidateIds.length === 0) {
    return { ok: true }
  }

  const [payRes, refundRes] = await Promise.all([
    admin
      .from("org_invoice_payments")
      .select("invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("invoice_id", candidateIds),
    admin
      .from("blitzpay_invoice_refunds")
      .select("org_invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("org_invoice_id", candidateIds)
      .eq("status", "succeeded"),
  ])

  if (payRes.error) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: payRes.error.message }
  }
  if (refundRes.error) {
    return { ok: false, httpStatus: 500, error: "invoice_check_failed", message: refundRes.error.message }
  }

  const payments = (payRes.data ?? []) as Array<{ invoice_id: string; amount_cents: number | null }>
  const refunds = (refundRes.data ?? []) as Array<{ org_invoice_id: string; amount_cents: number | null }>

  let blocking = 0
  for (const row of rows) {
    const grossPaid = netPaymentsCents(payments, row.id)
    const refunded = netRefundsCents(refunds, row.id)
    const paymentsTotalCents = Math.max(0, grossPaid - refunded)
    if (orgInvoiceBlocksOrganizationDelete(row, paymentsTotalCents)) {
      blocking += 1
    }
  }

  if (blocking > 0) {
    return {
      ok: false,
      httpStatus: 409,
      error: "unpaid_invoices",
      message: `Cannot delete: ${blocking} customer invoice(s) still have a balance due (sent, unpaid, or overdue with amount due > $0). Collect, void, or credit those invoices first.`,
    }
  }

  return { ok: true }
}
