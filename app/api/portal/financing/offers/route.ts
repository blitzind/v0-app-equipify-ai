import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { listPortalFinancingOffers } from "@/lib/blitzpay/blitzpay-financing-service"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const offers = await listPortalFinancingOffers(svc, portalUser.organization_id, portalUser.customer_id)
    const safe = offers.map((o) => ({
      id: o.id,
      financingApplicationId: o.financing_application_id,
      offerStatus: o.offer_status,
      offerAmountCents: Math.round(Number(o.offer_amount_cents)),
      estimatedAprPercent:
        o.estimated_apr_basis_points != null ? Math.round(Number(o.estimated_apr_basis_points)) / 100 : null,
      estimatedPaymentCents: o.estimated_payment_cents != null ? Math.round(Number(o.estimated_payment_cents)) : null,
      estimatedTermMonths: o.estimated_term_months,
      requiresDownPayment: o.requires_down_payment,
      downPaymentCents: o.down_payment_cents != null ? Math.round(Number(o.down_payment_cents)) : null,
      createdAt: o.created_at,
    }))
    return NextResponse.json({
      offers: safe,
      disclaimer:
        "Financing options are offered through third-party providers. Approval and terms are determined by the financing provider.",
    })
  } catch {
    return NextResponse.json({ error: "load_failed", message: "Could not load financing offers." }, { status: 500 })
  }
}
