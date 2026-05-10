import { NextResponse } from "next/server"
import { mapQuoteStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { isPortalQuoteCustomerActionableDb, quotePastExpirationYmd } from "@/lib/org-quotes-invoices/quote-approval"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data, error } = await svc
    .from("org_quotes")
    .select("id, quote_number, title, amount_cents, status, created_at, expires_at")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .is("archived_at", null)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json(
      { error: "Could not load quotes. Try again shortly.", items: [] },
      { status: 500 },
    )
  }

  const todayYmd = new Date().toISOString().slice(0, 10)

  return NextResponse.json({
    items: (data ?? []).map((r) => {
      const status = r.status as string
      const pastExp = quotePastExpirationYmd(r.expires_at as string | null, todayYmd)
      const actionable =
        isPortalQuoteCustomerActionableDb(status) && !pastExp && status !== "expired"
      return {
        id: r.id as string,
        quoteNumber: r.quote_number as string,
        title: r.title as string,
        amountCents: r.amount_cents as number,
        statusLabel: mapQuoteStatus(status),
        statusDb: status,
        createdAt: r.created_at as string,
        expiresAt: (r.expires_at as string | null) ?? null,
        expiredByDate: pastExp && status !== "expired",
        canApprove: actionable,
        canDecline: actionable,
      }
    }),
  })
}
