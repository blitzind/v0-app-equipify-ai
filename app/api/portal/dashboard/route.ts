import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { fetchPortalDashboardBundle } from "@/lib/portal/portal-dashboard-bundle"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx
  const bundle = await fetchPortalDashboardBundle(svc, portalUser.organization_id, portalUser.customer_id)
  return NextResponse.json(bundle)
}
