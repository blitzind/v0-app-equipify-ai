import { NextResponse } from "next/server"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"
import { isPortalQuoteCustomerActionableDb, quotePastExpirationYmd } from "@/lib/org-quotes-invoices/quote-approval"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_NOTE = 2000

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteId: string }> },
) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { quoteId } = await context.params
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "Invalid quote id." }, { status: 400 })
  }

  let note: string | null = null
  try {
    const body = (await request.json().catch(() => ({}))) as { note?: unknown }
    if (typeof body.note === "string") {
      const t = body.note.trim()
      note = t.length > 0 ? t.slice(0, MAX_NOTE) : null
    }
  } catch {
    note = null
  }

  const { svc, portalUser } = ctx
  const todayYmd = new Date().toISOString().slice(0, 10)

  const { data: row, error } = await svc
    .from("org_quotes")
    .select("id, customer_id, status, expires_at, archived_at")
    .eq("organization_id", portalUser.organization_id)
    .eq("id", quoteId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 })
  }

  if ((row.customer_id as string) !== portalUser.customer_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  if (row.archived_at) {
    return NextResponse.json({ error: "This quote is no longer available." }, { status: 409 })
  }

  const st = row.status as string
  if (!isPortalQuoteCustomerActionableDb(st)) {
    return NextResponse.json({ error: "This quote cannot be declined in its current state." }, { status: 409 })
  }

  if (quotePastExpirationYmd(row.expires_at as string | null, todayYmd)) {
    return NextResponse.json({ error: "This quote has expired. Contact your service provider for a new estimate." }, { status: 409 })
  }

  const decidedAt = new Date().toISOString()
  const { error: upErr } = await svc
    .from("org_quotes")
    .update({
      status: "declined",
      customer_portal_decision_at: decidedAt,
      portal_customer_note: note,
    })
    .eq("organization_id", portalUser.organization_id)
    .eq("id", quoteId)

  if (upErr) {
    return NextResponse.json({ error: "Could not update quote." }, { status: 500 })
  }

  const meta = await getRequestMeta()
  await logPortalActivity(svc, {
    organizationId: portalUser.organization_id,
    portalUserId: portalUser.id,
    action: "quote_declined",
    path: `/api/portal/quotes/${quoteId}/decline`,
    resourceType: "org_quote",
    resourceId: quoteId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({ ok: true })
}
