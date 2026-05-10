import { NextResponse } from "next/server"
import { mapInvoiceStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { buildPortalInvoicePaymentSummary } from "@/lib/portal/invoice-payment-summary"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id

  const { data, error } = await svc
    .from("org_invoices")
    .select("id, invoice_number, title, amount_cents, tax_amount_cents, status, issued_at, paid_at, due_date, equipment_id")
    .eq("organization_id", orgId)
    .eq("customer_id", portalUser.customer_id)
    .order("issued_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Could not load invoices." }, { status: 500 })
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
      .eq("organization_id", orgId)
      .in("invoice_id", ids)
    if (!payRes.error) {
      for (const p of payRes.data ?? []) {
        const iid = p.invoice_id as string
        payTotals.set(iid, (payTotals.get(iid) ?? 0) + Math.round(Number(p.amount_cents)))
      }
    }
  }

  return NextResponse.json({
    items: rows.map((r) => {
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
    }),
  })
}
