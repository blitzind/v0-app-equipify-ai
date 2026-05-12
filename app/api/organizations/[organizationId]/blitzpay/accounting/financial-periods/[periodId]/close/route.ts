import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { closeFinancialPeriod } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ organizationId: string; periodId: string }> }) {
  const { organizationId, periodId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(periodId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/accounting/financial-periods/[periodId]/close",
  )
  if (schemaResp) return schemaResp
  let mode: "soft_closed" | "closed" = "closed"
  try {
    const j = (await request.json()) as { mode?: string }
    if (j.mode === "soft_closed") mode = "soft_closed"
  } catch {
    /* body optional */
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await closeFinancialPeriod(admin, organizationId, periodId, mode)
    return NextResponse.json({ ok: true, mode })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST accounting/financial-periods/close", e)
  }
}
