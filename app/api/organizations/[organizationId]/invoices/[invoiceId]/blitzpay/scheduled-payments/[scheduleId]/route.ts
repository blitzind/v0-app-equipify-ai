import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { cancelBlitzpayScheduledInvoicePayment } from "@/lib/blitzpay/blitzpay-scheduled-payments"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function DELETE(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string; scheduleId: string }> },
) {
  const { organizationId, invoiceId, scheduleId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId) || !UUID_RE.test(scheduleId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "DELETE /api/organizations/[organizationId]/invoices/[invoiceId]/blitzpay/scheduled-payments/[scheduleId]",
  )
  if (drift) return drift

  const reason = new URL(request.url).searchParams.get("reason")?.trim() || "staff_cancelled"
  const res = await cancelBlitzpayScheduledInvoicePayment(admin, organizationId, invoiceId, scheduleId, gate.userId, reason)
  if (!res.ok) {
    return NextResponse.json({ error: res.code, message: res.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
