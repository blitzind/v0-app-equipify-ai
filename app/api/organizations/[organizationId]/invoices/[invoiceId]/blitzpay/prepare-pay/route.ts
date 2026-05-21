import { NextResponse } from "next/server"
import { requireAnyOrgPermissionFromRequest } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  prepareBlitzpayInvoiceHostedCheckout,
  previewBlitzpayInvoiceHostedCheckout,
} from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params

  const gate = await requireAnyOrgPermissionFromRequest(request, organizationId, [
    "canEditInvoices",
    "canViewFinancials",
  ])
  if ("error" in gate) {
    return gate.error
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  let preferredPaymentMethodType: "card" | "us_bank_account" | undefined
  let invoicePortionCents: number | null | undefined
  try {
    const body = (await request.json()) as { paymentMethodType?: string; invoicePortionCents?: number | null }
    if (body.paymentMethodType === "card" || body.paymentMethodType === "us_bank_account") {
      preferredPaymentMethodType = body.paymentMethodType
    }
    if (body.invoicePortionCents != null && Number.isFinite(Number(body.invoicePortionCents))) {
      invoicePortionCents = Math.round(Number(body.invoicePortionCents))
    }
  } catch {
    preferredPaymentMethodType = undefined
  }

  const result = await prepareBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId,
    initiatedBy: "staff_dashboard",
    userId: gate.userId,
    preferredPaymentMethodType,
    invoicePortionCents,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    )
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
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  const gate = await requireAnyOrgPermissionFromRequest(request, organizationId, [
    "canEditInvoices",
    "canViewFinancials",
  ])
  if ("error" in gate) return gate.error

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
    "GET /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/prepare-pay",
  )
  if (drift) return drift

  const preview = await previewBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId,
    initiatedBy: "staff_dashboard",
    userId: gate.userId,
    invoicePortionCents,
  })
  if (!preview.ok) {
    return NextResponse.json({ error: preview.code, message: preview.message }, { status: preview.status })
  }
  return NextResponse.json({ pricing: preview.data })
}
