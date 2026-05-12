import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getPublicAppOrigin } from "@/lib/email/config"
import {
  prepareBlitzpayQuoteHostedCheckout,
  previewBlitzpayQuoteHostedCheckout,
} from "@/lib/blitzpay/blitzpay-prepare-quote-pay"
import { shapePortalBlitzpayPreparePaySuccessResponse } from "@/lib/blitzpay/blitzpay-payload-sanitization"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ quoteId: string }> },
) {
  const portalCtx = await requirePortalSession()
  if (portalCtx instanceof NextResponse) return portalCtx

  const { quoteId } = await context.params
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid quote id." }, { status: 400 })
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

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/portal/quotes/[quoteId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  let preferredPaymentMethodType: "card" | "us_bank_account" | undefined
  let acknowledgeFuturePaymentAuthorization: boolean | undefined
  try {
    const body = (await request.json()) as {
      paymentMethodType?: string
      acknowledgeFuturePaymentAuthorization?: boolean
    }
    if (body.paymentMethodType === "card" || body.paymentMethodType === "us_bank_account") {
      preferredPaymentMethodType = body.paymentMethodType
    }
    acknowledgeFuturePaymentAuthorization = Boolean(body.acknowledgeFuturePaymentAuthorization)
  } catch {
    preferredPaymentMethodType = undefined
  }

  const origin = getPublicAppOrigin().replace(/\/+$/, "")
  const successUrl = `${origin}/portal/quotes/${encodeURIComponent(quoteId)}?blitzpay=1&status=success`
  const cancelUrl = `${origin}/portal/quotes/${encodeURIComponent(quoteId)}?blitzpay=1&status=cancel`

  const result = await prepareBlitzpayQuoteHostedCheckout({
    admin,
    organizationId,
    quoteId,
    initiatedBy: "customer_portal",
    portalUserId,
    portalCustomerId,
    returnUrls: { successUrl, cancelUrl },
    preferredPaymentMethodType,
    acknowledgeFuturePaymentAuthorization,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  return NextResponse.json(shapePortalBlitzpayPreparePaySuccessResponse(result.data))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ quoteId: string }> },
) {
  const portalCtx = await requirePortalSession()
  if (portalCtx instanceof NextResponse) return portalCtx
  const { quoteId } = await context.params
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "invalid_request", message: "Invalid quote id." }, { status: 400 })
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
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/portal/quotes/[quoteId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  const preview = await previewBlitzpayQuoteHostedCheckout({
    admin,
    organizationId,
    quoteId,
    initiatedBy: "customer_portal",
    portalUserId,
    portalCustomerId,
    returnUrls: { successUrl: "", cancelUrl: "" },
  })
  if (!preview.ok) {
    return NextResponse.json({ error: preview.code, message: preview.message }, { status: preview.status })
  }
  return NextResponse.json({ pricing: preview.data })
}
