import { NextResponse } from "next/server"
import { mapQuoteStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data, error } = await svc
    .from("org_quotes")
    .select("id, quote_number, title, amount_cents, status, created_at")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: "Could not load quotes." }, { status: 500 })
  }

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      id: r.id as string,
      quoteNumber: r.quote_number as string,
      title: r.title as string,
      amountCents: r.amount_cents as number,
      statusLabel: mapQuoteStatus(r.status as string),
      createdAt: r.created_at as string,
      canApprove: (r.status as string) === "sent",
    })),
  })
}
