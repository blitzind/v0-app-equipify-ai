import { NextResponse } from "next/server"
import { mapInvoiceStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data, error } = await svc
    .from("org_invoices")
    .select("id, invoice_number, title, amount_cents, status, issued_at, paid_at, equipment_id")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .order("issued_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: "Could not load invoices." }, { status: 500 })
  }

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      invoiceNumber: r.invoice_number as string,
      title: r.title as string,
      amountCents: r.amount_cents as number,
      statusLabel: mapInvoiceStatus(r.status as string),
      issuedAt: r.issued_at as string,
      paidAt: (r.paid_at as string | null) ?? null,
      equipmentId: (r.equipment_id as string | null) ?? null,
      payOnlineReady: false,
    })),
  })
}
