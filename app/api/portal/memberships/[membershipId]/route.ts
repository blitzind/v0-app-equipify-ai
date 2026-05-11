import { NextResponse } from "next/server"
import { fetchPortalMembershipDetail } from "@/lib/portal/portal-memberships"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ membershipId: string }> },
) {
  const { membershipId } = await context.params
  if (!UUID_RE.test(membershipId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 })
  }
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const membership = await fetchPortalMembershipDetail(
      svc,
      portalUser.organization_id,
      portalUser.customer_id,
      membershipId,
    )
    if (!membership) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ membership })
  } catch {
    return NextResponse.json({ error: "Could not load membership." }, { status: 500 })
  }
}
