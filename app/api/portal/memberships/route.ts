import { NextResponse } from "next/server"
import { fetchPortalMembershipList } from "@/lib/portal/portal-memberships"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const memberships = await fetchPortalMembershipList(svc, portalUser.organization_id, portalUser.customer_id)
    return NextResponse.json({ memberships })
  } catch {
    return NextResponse.json({ error: "Could not load memberships." }, { status: 500 })
  }
}
