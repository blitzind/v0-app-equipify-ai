import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getPublicAppOrigin } from "@/lib/email/config"
import {
  prepareBlitzpayInvoiceHostedCheckout,
  previewBlitzpayInvoiceHostedCheckout,
} from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
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

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/portal/invoices/[invoiceId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  let preferredPaymentMethodType: "card" | "us_bank_account" | undefined
  let invoicePortionCents: number | null | undefined
  let acknowledgeFuturePaymentAuthorization: boolean | undefined
  try {
    const body = (await request.json()) as {
      paymentMethodType?: string
      invoicePortionCents?: number | null
      acknowledgeFuturePaymentAuthorization?: boolean
    }
    if (body.paymentMethodType === "card" || body.paymentMethodType === "us_bank_account") {
      preferredPaymentMethodType = body.paymentMethodType
    }
    if (body.invoicePortionCents != null && Number.isFinite(Number(body.invoicePortionCents))) {
      invoicePortionCents = Math.round(Number(body.invoicePortionCents))
    }
    acknowledgeFuturePaymentAuthorization = Boolean(body.acknowledgeFuturePaymentAuthorization)
  } catch {
    preferredPaymentMethodType = undefined
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
    preferredPaymentMethodType,
    invoicePortionCents,
    acknowledgeFuturePaymentAuthorization,
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

export async function GET(
  request: Request,
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

  const portionParam = new URL(request.url).searchParams.get("invoicePortionCents")
  const invoicePortionCents =
    portionParam != null && portionParam !== "" && Number.isFinite(Number(portionParam)) ?
      Math.round(Number(portionParam))
    : undefined

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/portal/invoices/[invoiceId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  const preview = await previewBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId,
    initiatedBy: "customer_portal",
    portalUserId,
    portalCustomerId,
    returnUrls: { successUrl: "", cancelUrl: "" },
    invoicePortionCents,
  })
  if (!preview.ok) {
    return NextResponse.json({ error: preview.code, message: preview.message }, { status: preview.status })
  }
  return NextResponse.json({ pricing: preview.data })
}
