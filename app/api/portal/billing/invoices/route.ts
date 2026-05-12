import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { humanCollectionStatusLabel } from "@/lib/blitzpay/blitzpay-collections-engine"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

export const runtime = "nodejs"

const CAP = 40

function portalBalanceLabel(status: string, paidAt: string | null): string {
  if (paidAt || status === "paid") return "Paid"
  if (status === "overdue") return "Past due"
  if (status === "sent") return "Open"
  return "Open"
}

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const { data: invs, error: iErr } = await svc
      .from("org_invoices")
      .select("id, invoice_number, title, amount_cents, status, due_date, paid_at, issued_at")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .order("issued_at", { ascending: false })
      .limit(CAP)
    if (iErr) throw new Error(iErr.message)
    const rows = (invs ?? []) as Array<{
      id: string
      invoice_number: string
      title: string
      amount_cents: number
      status: string
      due_date: string | null
      paid_at: string | null
      issued_at: string
    }>
    const ids = rows.map((r) => r.id)
    let collByInv = new Map<
      string,
      { collectionStatus: string; statusLabel: string; followUpScheduledFor: string | null }
    >()
    if (ids.length) {
      const { data: cRows, error: cErr } = await svc
        .from("blitzpay_invoice_collection_states")
        .select("invoice_id, collection_status, next_retry_at, recovery_paused")
        .eq("organization_id", portalUser.organization_id)
        .eq("customer_id", portalUser.customer_id)
        .in("invoice_id", ids)
      if (!cErr && cRows) {
        for (const c of cRows as Array<{
          invoice_id: string
          collection_status: string
          next_retry_at: string | null
          recovery_paused: boolean
        }>) {
          collByInv.set(c.invoice_id, {
            collectionStatus: c.collection_status,
            statusLabel: humanCollectionStatusLabel(c.collection_status),
            followUpScheduledFor: c.next_retry_at && !c.recovery_paused ? c.next_retry_at.slice(0, 10) : null,
          })
        }
      }
    }
    const invoices = rows.map((r) => {
      const c = collByInv.get(r.id)
      return {
        id: r.id,
        referenceLabel: r.invoice_number,
        title: r.title,
        amountCents: Math.round(Number(r.amount_cents)),
        balanceLabel: portalBalanceLabel(r.status, r.paid_at),
        dueDate: r.due_date,
        issuedAt: r.issued_at,
        collectionHint: c?.statusLabel ?? null,
        followUpScheduledFor: c?.followUpScheduledFor ?? null,
        needsAttention:
          Boolean(c && ["failed", "escalated", "retry_scheduled", "retry_in_progress"].includes(c.collectionStatus)) &&
          !r.paid_at,
      }
    })
    return NextResponse.json({ invoices })
  } catch (e) {
    logBlitzpayServerFailure("GET portal/billing/invoices", e)
    return NextResponse.json({ error: "Could not load invoices." }, { status: 500 })
  }
}
