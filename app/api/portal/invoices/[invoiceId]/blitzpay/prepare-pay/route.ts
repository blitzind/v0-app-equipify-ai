import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getPublicAppOrigin } from "@/lib/email/config"
import { prepareBlitzpayInvoiceHostedCheckout } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ invoiceId: string }> },
) {
  const portalCtx = await requirePortalSession()
  if (portalCtx instanceof NextResponse) return portalCtx

  const { invoiceId } = await context.params
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid invoice id." }, { status: 400 })
  }

  const organizationId = portalCtx.portalUser.organization_id
  const portalUserId = portalCtx.portalUser.id
  const portalCustomerId = portalCtx.portalUser.customer_id

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const origin = getPublicAppOrigin().replace(/\/+$/, "")
  const successUrl = `${origin}/portal/invoices/${encodeURIComponent(invoiceId)}?blitzpay=1&status=success`
  const cancelUrl = `${origin}/portal/invoices/${encodeURIComponent(invoiceId)}?blitzpay=1&status=cancel`

  const result = await prepareBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId,
    initiatedBy: "customer_portal",
    portalUserId,
    portalCustomerId,
    returnUrls: { successUrl, cancelUrl },
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    url: result.data.url,
    checkoutSessionId: result.data.checkoutSessionId,
    stripePaymentIntentId: result.data.stripePaymentIntentId,
    blitzpayPaymentIntentRowId: result.data.blitzpayPaymentIntentRowId,
  })
}
