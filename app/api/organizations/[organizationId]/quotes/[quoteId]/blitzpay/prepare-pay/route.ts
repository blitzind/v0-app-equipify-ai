import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  prepareBlitzpayQuoteHostedCheckout,
  previewBlitzpayQuoteHostedCheckout,
} from "@/lib/blitzpay/blitzpay-prepare-quote-pay"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; quoteId: string }> },
) {
  const { organizationId, quoteId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canEditQuotes", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/quotes/[quoteId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  let preferredPaymentMethodType: "card" | "us_bank_account" | undefined
  try {
    const body = (await request.json()) as { paymentMethodType?: string }
    if (body.paymentMethodType === "card" || body.paymentMethodType === "us_bank_account") {
      preferredPaymentMethodType = body.paymentMethodType
    }
  } catch {
    preferredPaymentMethodType = undefined
  }

  const result = await prepareBlitzpayQuoteHostedCheckout({
    admin,
    organizationId,
    quoteId,
    initiatedBy: "staff_dashboard",
    userId: gate.userId,
    preferredPaymentMethodType,
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
  _request: Request,
  context: { params: Promise<{ organizationId: string; quoteId: string }> },
) {
  const { organizationId, quoteId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditQuotes", "canViewFinancials"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/quotes/[quoteId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  const preview = await previewBlitzpayQuoteHostedCheckout({
    admin,
    organizationId,
    quoteId,
    initiatedBy: "staff_dashboard",
    userId: gate.userId,
  })
  if (!preview.ok) {
    return NextResponse.json({ error: preview.code, message: preview.message }, { status: preview.status })
  }
  return NextResponse.json({ pricing: preview.data })
}
