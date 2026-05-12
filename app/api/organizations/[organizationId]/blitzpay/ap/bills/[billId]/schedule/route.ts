import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { scheduleVendorBill } from "@/lib/blitzpay/blitzpay-ap-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ organizationId: string; billId: string }> }) {
  const { organizationId, billId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(billId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/ap/bills/[billId]/schedule",
  )
  if (schemaResp) return schemaResp
  let body: { scheduledFor?: string | null }
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await scheduleVendorBill(admin, organizationId, billId, gate.userId, { scheduledForIso: body.scheduledFor ?? null })
    return NextResponse.json({ ok: true, note: "Orchestration only — no funds are transmitted automatically." })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("not_approved") || msg.includes("allocation")) {
      return NextResponse.json({ error: "validation_error", message: msg }, { status: 400 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/ap/bills/schedule", e)
  }
}
