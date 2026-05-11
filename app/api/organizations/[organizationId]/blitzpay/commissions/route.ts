import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { listBlitzpayPayrollCommissions } from "@/lib/blitzpay/blitzpay-payroll-runs"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/commissions",
  )
  if (schemaResp) return schemaResp

  let technicianUserId: string | null = null
  let workOrderId: string | null = null
  let status: string | null = null
  let limit = 80
  try {
    const u = new URL(request.url)
    technicianUserId = u.searchParams.get("technicianUserId")
    workOrderId = u.searchParams.get("workOrderId")
    status = u.searchParams.get("status")
    const rawL = u.searchParams.get("limit")
    if (rawL != null) limit = Number(rawL)
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
    const commissions = await listBlitzpayPayrollCommissions(admin, organizationId, {
      technicianUserId,
      workOrderId,
      status,
      limit,
    })
    return NextResponse.json({ commissions })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}
