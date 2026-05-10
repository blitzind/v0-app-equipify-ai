import type { SupabaseClient } from "@supabase/supabase-js"
import { mapInvoiceStatus } from "@/lib/portal/display-mappers"
import { buildPortalInvoicePaymentSummary } from "@/lib/portal/invoice-payment-summary"

/** Shared list payload for `/api/portal/invoices` and staff preview (same customer scope). */
export async function fetchPortalInvoiceListItems(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<
  Array<{
    id: string
    invoiceNumber: string
    title: string
    amountCents: number
    totalDueCents: number
    totalPaidCents: number
    balanceDueCents: number
    paymentStatusLabel: string
    statusLabel: string
    issuedAt: string
    paidAt: string | null
    dueDate: string | null
    equipmentId: string | null
    payOnlineReady: boolean
  }>
> {
  const { data, error } = await svc
    .from("org_invoices")
    .select("id, invoice_number, title, amount_cents, tax_amount_cents, status, issued_at, paid_at, due_date, equipment_id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .order("issued_at", { ascending: false })
    .limit(200)

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as Array<{
    id: string
    invoice_number: string
    title: string
    amount_cents: number
    tax_amount_cents?: number | null
    status: string
    issued_at: string
    paid_at: string | null
    due_date?: string | null
    equipment_id: string | null
  }>

  const ids = rows.map((r) => r.id)
  const payTotals = new Map<string, number>()
  if (ids.length > 0) {
    const payRes = await svc
      .from("org_invoice_payments")
      .select("invoice_id, amount_cents")
      .eq("organization_id", organizationId)
      .in("invoice_id", ids)
    if (!payRes.error) {
      for (const p of payRes.data ?? []) {
        const iid = p.invoice_id as string
        payTotals.set(iid, (payTotals.get(iid) ?? 0) + Math.round(Number(p.amount_cents)))
      }
    }
  }

  return rows.map((r) => {
    const paySum = payTotals.get(r.id) ?? 0
    const pay = buildPortalInvoicePaymentSummary(
      { amount_cents: r.amount_cents, tax_amount_cents: r.tax_amount_cents, status: r.status },
      paySum,
    )
    return {
      id: r.id,
      invoiceNumber: r.invoice_number,
      title: r.title,
      amountCents: r.amount_cents,
      totalDueCents: pay.totalDueCents,
      totalPaidCents: pay.totalPaidCents,
      balanceDueCents: pay.balanceDueCents,
      paymentStatusLabel: pay.paymentStatusLabel,
      statusLabel: mapInvoiceStatus(r.status),
      issuedAt: r.issued_at,
      paidAt: r.paid_at ?? null,
      dueDate: r.due_date ?? null,
      equipmentId: r.equipment_id ?? null,
      payOnlineReady: false,
    }
  })
}
