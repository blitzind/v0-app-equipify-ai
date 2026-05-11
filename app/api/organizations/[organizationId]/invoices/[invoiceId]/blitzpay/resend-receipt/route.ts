import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { executeStaffBlitzpayReceiptResend } from "@/lib/blitzpay/blitzpay-receipt-email-dispatch"
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

  let body: { blitzpayPaymentIntentInternalId?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const piId =
    typeof body.blitzpayPaymentIntentInternalId === "string" ? body.blitzpayPaymentIntentInternalId.trim() : ""
  if (!UUID_RE.test(piId)) {
    return NextResponse.json(
      { error: "bad_request", message: "blitzpayPaymentIntentInternalId must be a UUID." },
      { status: 400 },
    )
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/resend-receipt",
  )
  if (drift) return drift

  try {
    const result = await executeStaffBlitzpayReceiptResend(admin, {
      organizationId,
      orgInvoiceId: invoiceId,
      internalBlitzpayPaymentIntentId: piId,
    })
    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404
        : result.code === "bad_request" ? 400
        : result.code === "not_configured" ? 503
        : 502
      return NextResponse.json({ error: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ ok: true, dispatchId: result.dispatchId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "server_error", message: msg || "Resend failed." }, { status: 500 })
  }
}
