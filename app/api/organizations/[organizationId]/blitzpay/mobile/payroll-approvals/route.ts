import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  BLITZPAY_MOBILE_PAYROLL_LIST_CAP,
  formatMobilePayrollApprovalRowForApi,
  isBlitzpayMobileFinancePrivilegedRole,
} from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOBILE_GATE = ["canViewFinancials", "canViewFinancialReports", "canAssistBlitzpayCollection"] as const

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/mobile/payroll-approvals",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const privileged = isBlitzpayMobileFinancePrivilegedRole(gate.role)
    let q = admin
      .from("blitzpay_mobile_payroll_approval_items")
      .select(
        "id, technician_id, payroll_run_id, work_order_id, approval_status, approval_type, amount_cents, submitted_at, approved_at, approved_by, dispute_reason, metadata, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("submitted_at", { ascending: false })
      .limit(BLITZPAY_MOBILE_PAYROLL_LIST_CAP)
    if (!privileged) {
      q = q.eq("technician_id", gate.userId)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      items: (data ?? []).map((r) => formatMobilePayrollApprovalRowForApi(r as Record<string, unknown>)),
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/mobile/payroll-approvals", e)
  }
}
