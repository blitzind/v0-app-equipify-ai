import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  getCollectionsSummary,
  listCollectionActivitySafe,
  listCollectionStatesSafe,
} from "@/lib/blitzpay/blitzpay-collections-service"
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
    "GET /api/organizations/[organizationId]/blitzpay/collections",
  )
  if (schemaResp) return schemaResp
  let invoiceId: string | null = null
  try {
    invoiceId = new URL(request.url).searchParams.get("invoiceId")
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
    const [summary, states, activities] = await Promise.all([
      getCollectionsSummary(admin, organizationId),
      listCollectionStatesSafe(admin, organizationId, {
        invoiceId: invoiceId && UUID_RE.test(invoiceId) ? invoiceId : undefined,
      }),
      listCollectionActivitySafe(admin, organizationId, invoiceId && UUID_RE.test(invoiceId) ? { invoiceId } : undefined),
    ])
    return NextResponse.json({ summary, states, activities })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/collections", e)
  }
}
