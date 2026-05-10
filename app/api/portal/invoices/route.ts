import { NextResponse } from "next/server"
import { fetchPortalInvoiceListItems } from "@/lib/portal/portal-invoice-list"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  try {
    const items = await fetchPortalInvoiceListItems(svc, portalUser.organization_id, portalUser.customer_id)
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: "Could not load invoices." }, { status: 500 })
  }
}
