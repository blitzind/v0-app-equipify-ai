import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  BLITZPAY_MOBILE_TREASURY_LIST_CAP,
  insertBlitzpayMobileAuditLog,
  isBlitzpayMobileFinancePrivilegedRole,
  sanitizeMobileTreasurySnapshotForFieldRole,
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
    "GET /api/organizations/[organizationId]/blitzpay/mobile/treasury-summary",
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
      .from("blitzpay_mobile_treasury_snapshots")
      .select(
        "id, snapshot_date, visible_to_role, available_cash_cents, upcoming_payables_cents, upcoming_payroll_cents, collections_due_cents, treasury_health_score, created_at",
      )
      .eq("organization_id", organizationId)
      .order("snapshot_date", { ascending: false })
      .limit(BLITZPAY_MOBILE_TREASURY_LIST_CAP)
    if (!privileged) {
      q = q.eq("visible_to_role", "technician")
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const items = (data ?? []).map((r) => {
      const row = r as {
        snapshot_date: string
        visible_to_role: string
        available_cash_cents: number | null
        upcoming_payables_cents: number | null
        upcoming_payroll_cents: number | null
        collections_due_cents: number | null
        treasury_health_score: number | null
      }
      return sanitizeMobileTreasurySnapshotForFieldRole(row)
    })
    await insertBlitzpayMobileAuditLog(admin, {
      organization_id: organizationId,
      audit_type: "treasury_snapshot_viewed",
      actor_type: privileged ? "user" : "technician",
      actor_id: gate.userId,
      audit_summary: "Mobile treasury summary viewed",
      metadata: { count: String(items.length) },
    })
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      items,
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/mobile/treasury-summary", e)
  }
}
