import { NextResponse } from "next/server"
import { mapQuoteStatus } from "@/lib/portal/display-mappers"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { isPortalQuoteCustomerActionableDb, quotePastExpirationYmd } from "@/lib/org-quotes-invoices/quote-approval"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
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
    .select(
      [
        "id",
        "customer_id",
        "quote_number",
        "title",
        "amount_cents",
        "status",
        "created_at",
        "expires_at",
        "archived_at",
        "blitzpay_deposit_mode",
        "blitzpay_deposit_fixed_cents",
        "blitzpay_deposit_percentage_bps",
        "blitzpay_deposit_collected_cents",
        "blitzpay_deposit_target_cents",
        "blitzpay_financing_ready",
        "blitzpay_converted_invoice_id",
      ].join(", "),
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("id", quoteId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "Quote not found." }, { status: 404 })
  }

  if ((row as { customer_id?: string }).customer_id !== portalUser.customer_id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }

  const r = row as Record<string, unknown>
  const status = String(r.status ?? "")
  const todayYmd = new Date().toISOString().slice(0, 10)
  const pastExp = quotePastExpirationYmd((r.expires_at as string | null) ?? null, todayYmd)
  const actionable = isPortalQuoteCustomerActionableDb(status) && !pastExp && status !== "expired"
  const amountCents = Math.round(Number(r.amount_cents ?? 0))
  const collected = Math.max(0, Math.round(Number(r.blitzpay_deposit_collected_cents ?? 0)))
  const remainingAfterDeposit = Math.max(0, amountCents - collected)

  return NextResponse.json({
    id: r.id as string,
    quoteNumber: String(r.quote_number ?? ""),
    title: String(r.title ?? ""),
    amountCents,
    statusLabel: mapQuoteStatus(status),
    statusDb: status,
    createdAt: String(r.created_at ?? ""),
    expiresAt: (r.expires_at as string | null) ?? null,
    expiredByDate: pastExp && status !== "expired",
    canApprove: actionable,
    canDecline: actionable,
    archivedAt: (r.archived_at as string | null) ?? null,
    blitzpayDepositMode: String(r.blitzpay_deposit_mode ?? "none"),
    blitzpayDepositFixedCents:
      r.blitzpay_deposit_fixed_cents == null ? null : Math.round(Number(r.blitzpay_deposit_fixed_cents)),
    blitzpayDepositPercentageBps:
      r.blitzpay_deposit_percentage_bps == null ? null : Math.round(Number(r.blitzpay_deposit_percentage_bps)),
    blitzpayDepositCollectedCents: collected,
    blitzpayDepositTargetCentsStored:
      r.blitzpay_deposit_target_cents == null ? null : Math.round(Number(r.blitzpay_deposit_target_cents)),
    blitzpayRemainingQuoteCents: remainingAfterDeposit,
    blitzpayFinancingReady: Boolean(r.blitzpay_financing_ready),
    blitzpayConvertedInvoiceId: (r.blitzpay_converted_invoice_id as string | null) ?? null,
  })
}
