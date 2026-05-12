import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { cancelFinancingApplication } from "@/lib/blitzpay/blitzpay-financing-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(_request: Request, context: { params: Promise<{ organizationId: string; applicationId: string }> }) {
  const { organizationId, applicationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(applicationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/financing/applications/[applicationId]/cancel",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await cancelFinancingApplication(admin, organizationId, applicationId, gate.userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (msg === "not_found") {
      return NextResponse.json({ error: "not_found", message: "Application not found." }, { status: 404 })
    }
    if (msg === "invalid_application_state") {
      return NextResponse.json({ error: "invalid_state", message: "Application cannot be canceled in its current state." }, { status: 400 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/financing/applications/cancel", e)
  }
}
