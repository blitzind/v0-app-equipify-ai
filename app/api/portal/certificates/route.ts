import { NextResponse } from "next/server"
import { buildPortalCertificateItems } from "@/lib/portal/portal-certificate-items"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const orgId = portalUser.organization_id
  const custId = portalUser.customer_id

  try {
    const { items, summary } = await buildPortalCertificateItems(svc, orgId, custId)
    return NextResponse.json({ items, summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load certificates."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
