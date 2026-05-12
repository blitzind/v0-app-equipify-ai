import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { fetchBlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import {
  BLITZPAY_MOBILE_AUDIT_LIST_CAP,
  BLITZPAY_MOBILE_INTENT_LIST_CAP,
  isBlitzpayMobileFinancePrivilegedRole,
} from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOBILE_GATE = ["canViewFinancials", "canViewFinancialReports", "canAssistBlitzpayCollection"] as const

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/mobile/health",
  )
  if (schemaResp) return schemaResp
  let sinceIso: string | null = null
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("since")
    if (raw && raw.trim()) sinceIso = new Date(raw).toISOString()
  } catch {
    /* ignore */
  }
  if (!sinceIso) sinceIso = new Date(Date.now() - 30 * 86400_000).toISOString()
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const snap = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, {
      sinceIso,
      skipMultiEntity: true,
      skipSupplierNetwork: true,
      skipClaimsWarranty: true,
      skipMobilePhase6a: true,
      skipObservabilityPhase6b: true,
    })
    const privileged = isBlitzpayMobileFinancePrivilegedRole(gate.role)
    const { buildPhase6aMobileReportingSlice } = await import("@/lib/blitzpay/blitzpay-mobile-financial-ops")
    const phase6a = await buildPhase6aMobileReportingSlice(admin, organizationId, {
      treasuryFailedPayoutCount30d: snap.treasuryFailedPayoutCount30d,
      estimatedOperatingCashCents: snap.estimatedOperatingCashCents,
    })
    let auditQuery = admin
      .from("blitzpay_mobile_audit_log")
      .select("audit_type, audit_summary, created_at, mobile_intent_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(BLITZPAY_MOBILE_AUDIT_LIST_CAP)
    if (!privileged) {
      const { data: intents, error: ie } = await admin
        .from("blitzpay_mobile_financial_intents")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("technician_id", gate.userId)
        .order("updated_at", { ascending: false })
        .limit(BLITZPAY_MOBILE_INTENT_LIST_CAP)
      if (ie) throw new Error(ie.message)
      const ids = (intents ?? []).map((r) => (r as { id: string }).id)
      if (!ids.length) {
        return NextResponse.json({
          disclaimer:
            "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
          sinceIso,
          phase6a,
          recentActivity: [],
        })
      }
      auditQuery = auditQuery.in("mobile_intent_id", ids)
    }
    const { data: audits, error: aErr } = await auditQuery
    if (aErr) throw new Error(aErr.message)
    const recentActivity = (audits ?? []).map((r) => ({
      audit_type: (r as { audit_type: string }).audit_type,
      audit_summary: (r as { audit_summary: string }).audit_summary,
      created_at: (r as { created_at: string }).created_at,
    }))
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      sinceIso,
      phase6a,
      recentActivity,
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/mobile/health", e)
  }
}
