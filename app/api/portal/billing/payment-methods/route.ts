import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import { listPaymentMethodsSafe } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { logBlitzpayServerFailure } from "@/lib/blitzpay/blitzpay-server-failure-log"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx
  const { svc, portalUser } = ctx
  try {
    const paymentMethods = await listPaymentMethodsSafe(svc, portalUser.organization_id, {
      customerId: portalUser.customer_id,
    })
    return NextResponse.json({
      paymentMethods: paymentMethods.map((p) => ({
        displayLabel: p.displayLabel,
        paymentMethodType: p.paymentMethodType,
        isDefault: p.isDefault,
        status: p.status,
      })),
    })
  } catch (e) {
    logBlitzpayServerFailure("GET portal/billing/payment-methods", e)
    return NextResponse.json({ error: "Could not load payment methods." }, { status: 500 })
  }
}
