import { NextResponse } from "next/server"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ quoteId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { quoteId } = await context.params
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "Invalid quote id." }, { status: 400 })
  }

  const { svc, portalUser } = ctx

  const { data: row, error } = await svc
    .from("org_quotes")
    .select("id, customer_id, status")
    .eq("organization_id", portalUser.organization_id)
    .eq("id", quoteId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 })
  }

  if ((row.customer_id as string) !== portalUser.customer_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  if ((row.status as string) !== "sent") {
    return NextResponse.json({ error: "This quote cannot be approved in its current state." }, { status: 409 })
  }

  const { error: upErr } = await svc
    .from("org_quotes")
    .update({ status: "approved" })
    .eq("organization_id", portalUser.organization_id)
    .eq("id", quoteId)

  if (upErr) {
    return NextResponse.json({ error: "Could not update quote." }, { status: 500 })
  }

  const meta = await getRequestMeta()
  await logPortalActivity(svc, {
    organizationId: portalUser.organization_id,
    portalUserId: portalUser.id,
    action: "quote_approved",
    path: `/api/portal/quotes/${quoteId}/approve`,
    resourceType: "org_quote",
    resourceId: quoteId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ ok: true })
}
