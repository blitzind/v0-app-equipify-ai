import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { fetchStaffBlitzpayInvoiceAttemptActivity } from "@/lib/blitzpay/staff-blitzpay-invoice-activity"
import {
  fetchStaffBlitzpayInvoiceDisputes,
  fetchStaffBlitzpayInvoiceRefunds,
} from "@/lib/blitzpay/staff-blitzpay-invoice-support"
import { isOutboundEmailConfigured } from "@/lib/email/config"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
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

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/activity",
  )
  if (drift) return drift

  try {
    const [attempts, refunds, disputes] = await Promise.all([
      fetchStaffBlitzpayInvoiceAttemptActivity(admin, organizationId, invoiceId),
      fetchStaffBlitzpayInvoiceRefunds(admin, organizationId, invoiceId),
      fetchStaffBlitzpayInvoiceDisputes(admin, organizationId, invoiceId),
    ])
    return NextResponse.json({
      attempts,
      refunds,
      disputes,
      outboundEmail: { configured: isOutboundEmailConfigured() },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: "load_failed", message: msg || "Could not load BlitzPay activity." },
      { status: 500 },
    )
  }
}
