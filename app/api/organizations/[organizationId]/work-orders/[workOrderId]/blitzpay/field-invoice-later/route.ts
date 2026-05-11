import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; workOrderId: string }> },
) {
  const { organizationId, workOrderId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workOrderId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canAssistBlitzpayCollection"])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/work-orders/[workOrderId]/blitzpay/field-invoice-later",
  )
  if (drift) return drift

  const now = new Date().toISOString()
  const { error } = await admin
    .from("work_orders")
    .update({ blitzpay_field_invoice_later_at: now, updated_at: now })
    .eq("organization_id", organizationId)
    .eq("id", workOrderId)
  if (error) {
    return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, markedAt: now })
}
