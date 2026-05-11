import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { patchBlitzpayVendorPayable } from "@/lib/blitzpay/blitzpay-vendor-payables"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; payableId: string }> },
) {
  const { organizationId, payableId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(payableId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, ["canViewFinancials", "canEditInvoices"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "PATCH /api/organizations/[organizationId]/blitzpay/vendor-payables/[payableId]",
  )
  if (schemaResp) return schemaResp

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    await patchBlitzpayVendorPayable(admin, organizationId, payableId, {
      status: body.status != null ? String(body.status) : undefined,
      scheduledPayoutDate:
        body.scheduledPayoutDate === null ? null
        : body.scheduledPayoutDate !== undefined ? String(body.scheduledPayoutDate)
        : undefined,
      approvalNotes: body.approvalNotes !== undefined ? (body.approvalNotes == null ? null : String(body.approvalNotes)) : undefined,
      actingUserId: gate.userId,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const status = msg.includes("Invalid vendor payable") || msg.includes("not found") ? 400 : 500
    return NextResponse.json({ error: "patch_failed", message: msg }, { status })
  }
}
