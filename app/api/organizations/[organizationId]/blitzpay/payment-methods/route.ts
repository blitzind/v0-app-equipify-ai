import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { listPaymentMethodsSafe } from "@/lib/blitzpay/blitzpay-billing-profiles-service"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials", "canViewFinancialReports"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/payment-methods",
  )
  if (schemaResp) return schemaResp
  let customerId: string | null = null
  try {
    const u = new URL(request.url)
    customerId = u.searchParams.get("customerId")
  } catch {
    /* ignore */
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const paymentMethods = await listPaymentMethodsSafe(admin, organizationId, { customerId })
    return NextResponse.json({ paymentMethods })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET payment-methods", e)
  }
}
