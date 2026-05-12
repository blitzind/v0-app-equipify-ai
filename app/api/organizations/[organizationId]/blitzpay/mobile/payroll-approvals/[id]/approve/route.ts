import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { insertBlitzpayMobileAuditLog, isBlitzpayMobileFinancePrivilegedRole } from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { nextPayrollApprovalStatus, type MobilePayrollApprovalStatus } from "@/lib/blitzpay/blitzpay-mobile-payroll-approvals"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(_request: Request, context: { params: Promise<{ organizationId: string; id: string }> }) {
  const { organizationId, id } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization or id." }, { status: 400 })
  }
  const gate = await requireOrgPermission(organizationId, "canViewFinancialReports")
  if ("error" in gate) return gate.error
  if (!isBlitzpayMobileFinancePrivilegedRole(gate.role)) {
    return NextResponse.json({ error: "forbidden", message: "Finance role required." }, { status: 403 })
  }
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/mobile/payroll-approvals/[id]/approve",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    assertUuid(id, "id")
    const { data: row, error: gErr } = await admin
      .from("blitzpay_mobile_payroll_approval_items")
      .select("id, approval_status")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .limit(1)
      .maybeSingle()
    if (gErr) throw new Error(gErr.message)
    if (!row) {
      return NextResponse.json({ error: "not_found", message: "Payroll approval item not found." }, { status: 404 })
    }
    const from = (row as { approval_status: string }).approval_status as MobilePayrollApprovalStatus
    const next = nextPayrollApprovalStatus(from, "approve", "manager")
    if (!next) {
      return NextResponse.json({ error: "bad_request", message: "invalid_transition" }, { status: 400 })
    }
    const { error: uErr } = await admin
      .from("blitzpay_mobile_payroll_approval_items")
      .update({
        approval_status: next,
        approved_at: new Date().toISOString(),
        approved_by: gate.userId,
        dispute_reason: null,
      })
      .eq("organization_id", organizationId)
      .eq("id", id)
    if (uErr) throw new Error(uErr.message)
    await insertBlitzpayMobileAuditLog(admin, {
      organization_id: organizationId,
      audit_type: "payroll_item_reviewed",
      actor_type: "admin",
      actor_id: gate.userId,
      audit_summary: `Payroll approval item approved (${id})`,
      metadata: { payroll_item_id: id, to: next },
    })
    return NextResponse.json({ id, approval_status: next })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/mobile/payroll-approvals/[id]/approve", e)
  }
}
