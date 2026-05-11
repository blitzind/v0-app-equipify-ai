import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { fetchBlitzpayCustomerWalletSummary } from "@/lib/blitzpay/blitzpay-customer-wallet"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const organizationId = ctx.portalUser.organization_id
  const customerId = ctx.portalUser.customer_id

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(admin, "GET /api/portal/wallet")
  if (drift) return drift

  try {
    const summary = await fetchBlitzpayCustomerWalletSummary(admin, organizationId, customerId)
    return NextResponse.json({
      accountCreditCents: summary.availableCreditCents,
      refundableCreditCents: summary.refundableCreditCents,
      estimateDepositsOnOpenQuotesCents: summary.unappliedEstimateDepositCents,
      appliedCreditsCents: summary.appliedToInvoicesCents,
      recentActivity: summary.recentActivity.map((a) => ({
        label: a.label,
        amountCents: a.amountCents,
        createdAt: a.createdAt,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "wallet_load_failed", message: msg }, { status: 500 })
  }
}
