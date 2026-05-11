import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeInvoicePaymentAllocation,
  invoiceGrandTotalCents,
} from "@/lib/billing/invoice-payment-allocation"

export type InvoicePayEligibilityRow = {
  id: string
  organization_id: string
  customer_id: string
  amount_cents: number
  tax_amount_cents?: number | null
  status: string
  invoice_number: string
  title: string
  archived_at: string | null
  work_order_id?: string | null
}

export async function loadInvoiceForBlitzpayPay(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<InvoicePayEligibilityRow | null> {
  const { data, error } = await admin
    .from("org_invoices")
    .select(
      "id, organization_id, customer_id, amount_cents, tax_amount_cents, status, invoice_number, title, archived_at, work_order_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as InvoicePayEligibilityRow | null) ?? null
}

export async function sumRecordedPaymentsCents(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("org_invoice_payments")
    .select("amount_cents")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)

  if (error) throw new Error(error.message)
  return (data ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
}

/** Gross recorded payments minus succeeded BlitzPay refunds (invoice balance / hosted pay eligibility). */
export async function sumNetRecordedPaymentsCentsForBlitzpay(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<number> {
  const gross = await sumRecordedPaymentsCents(admin, organizationId, invoiceId)
  const { data, error } = await admin
    .from("blitzpay_invoice_refunds")
    .select("amount_cents")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .eq("status", "succeeded")

  if (error) throw new Error(error.message)
  const refunded = (data ?? []).reduce(
    (s, r) => s + Math.round(Number((r as { amount_cents: number }).amount_cents)),
    0,
  )
  return Math.max(0, gross - refunded)
}

export function assertInvoicePayableForBlitzpay(inv: InvoicePayEligibilityRow, paymentsTotalCents: number): void {
  if (inv.archived_at) {
    throw new Error("invoice_archived")
  }
  const st = String(inv.status || "").toLowerCase()
  if (st === "draft" || st === "void") {
    throw new Error("invoice_not_payable_status")
  }

  const totalDue = invoiceGrandTotalCents(inv)
  const { balanceDueCents, allocationState } = computeInvoicePaymentAllocation({
    invoiceTotalCents: totalDue,
    paymentsTotalCents,
    dbInvoiceStatus: st,
  })

  if (allocationState === "paid" || allocationState === "overpaid" || balanceDueCents <= 0) {
    throw new Error("invoice_no_balance_due")
  }
}

export function balanceDueCentsForBlitzpay(inv: InvoicePayEligibilityRow, paymentsTotalCents: number): number {
  const totalDue = invoiceGrandTotalCents(inv)
  const { balanceDueCents } = computeInvoicePaymentAllocation({
    invoiceTotalCents: totalDue,
    paymentsTotalCents,
    dbInvoiceStatus: String(inv.status || "").toLowerCase(),
  })
  return balanceDueCents
}
