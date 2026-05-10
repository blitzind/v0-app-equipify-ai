import { NextResponse } from "next/server"
import { fetchPortalWorkOrderListItems } from "@/lib/portal/portal-work-order-list"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  try {
    const items = await fetchPortalWorkOrderListItems(svc, portalUser.organization_id, portalUser.customer_id)
    return NextResponse.json({ items })
  } catch {
    return NextResponse.json({ error: "Could not load work orders." }, { status: 500 })
  }
}
