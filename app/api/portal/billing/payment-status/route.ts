import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const { data: invs, error: iErr } = await svc
      .from("org_invoices")
      .select("id, status, paid_at, due_date")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .limit(60)
    if (iErr) throw new Error(iErr.message)
    const rows = (invs ?? []) as Array<{
      id: string
      status: string
      paid_at: string | null
      due_date: string | null
    }>
    const today = new Date().toISOString().slice(0, 10)
    let upcoming = 0
    const ids = rows.map((r) => r.id)
    const attention = new Set<string>()
    for (const r of rows) {
      if (r.paid_at || r.status === "paid") continue
      if (r.due_date && r.due_date > today) upcoming++
      if (r.status === "overdue" || (r.due_date && r.due_date < today)) attention.add(r.id)
    }
    let retryScheduled = 0
    if (ids.length) {
      const { data: cRows, error: cErr } = await svc
        .from("blitzpay_invoice_collection_states")
        .select("invoice_id, collection_status, next_retry_at")
        .eq("organization_id", portalUser.organization_id)
        .eq("customer_id", portalUser.customer_id)
        .in("invoice_id", ids)
      if (!cErr && cRows) {
        for (const c of cRows as Array<{ invoice_id: string; collection_status: string; next_retry_at: string | null }>) {
          if (c.collection_status === "retry_scheduled" && c.next_retry_at) retryScheduled++
          if (["failed", "escalated", "retry_in_progress"].includes(c.collection_status)) attention.add(c.invoice_id)
        }
      }
    }
    const needsAttention = attention.size
    return NextResponse.json({
      upcomingPaymentsCount: upcoming,
      balancesNeedingAttentionCount: needsAttention,
      followUpScheduledCount: retryScheduled,
      summary:
        needsAttention > 0 ?
          "One or more balances may need your attention."
        : retryScheduled > 0 ?
          "A courteous follow-up is already scheduled."
        : "You are all caught up on scheduled payments.",
    })
  } catch (e) {
    logBlitzpayServerFailure("GET portal/billing/payment-status", e)
    return NextResponse.json({ error: "Could not load payment status." }, { status: 500 })
  }
}
