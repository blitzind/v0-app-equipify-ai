import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { fetchBlitzpayApDashboard } from "@/lib/blitzpay/blitzpay-vendor-payables"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function achPendingSettlementCount(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  organizationId: string,
): Promise<number> {
  const { data, error } = await admin
    .from("blitzpay_payment_intents")
    .select("amount_cents, ach_settlement_state")
    .eq("organization_id", organizationId)
    .eq("status", "succeeded")
    .eq("payment_method_type", "us_bank_account")
  if (error) throw new Error(error.message)
  let n = 0
  for (const r of data ?? []) {
    const row = r as { amount_cents: number; ach_settlement_state?: string | null }
    if (String(row.ach_settlement_state || "").toLowerCase() !== "settled") n += 1
  }
  return n
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/ap-dashboard",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const achPending = await achPendingSettlementCount(admin, organizationId)
    const dashboard = await fetchBlitzpayApDashboard(admin, organizationId, { achPendingCount: achPending })
    return NextResponse.json({ dashboard })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET ap-dashboard", e)
  }
}
