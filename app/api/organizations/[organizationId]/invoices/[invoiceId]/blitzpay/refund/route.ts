import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { executeStaffBlitzpayInvoiceRefund } from "@/lib/blitzpay/staff-blitzpay-refund"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) {
    return gate.error
  }

  let body: { orgInvoicePaymentId?: string; amountCents?: number | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const payId = typeof body.orgInvoicePaymentId === "string" ? body.orgInvoicePaymentId.trim() : ""
  if (!UUID_RE.test(payId)) {
    return NextResponse.json(
      { error: "bad_request", message: "orgInvoicePaymentId must be a UUID." },
      { status: 400 },
    )
  }

  const idemHeader = request.headers.get("Idempotency-Key")?.trim()
  const idempotencyKey = idemHeader && idemHeader.length > 8 ? idemHeader : `blitzpay_refund:${organizationId}:${payId}:${randomUUID()}`

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/refund",
  )
  if (drift) return drift

  const result = await executeStaffBlitzpayInvoiceRefund({
    admin,
    organizationId,
    invoiceId,
    orgInvoicePaymentId: payId,
    amountCents: body.amountCents,
    staffUserId: gate.userId,
    idempotencyKey,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  return NextResponse.json({
    stripeRefundId: result.stripeRefundId,
    amountBookedCents: result.amountBookedCents,
    pending: result.pending,
  })
}
