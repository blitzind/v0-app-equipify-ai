import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { buildClaimsProtectionHealthPayload } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DISCLAIMER =
  "Claims, warranty, and protection-plan tools support operational tracking and financial visibility only. Coverage decisions and payouts remain subject to your organization's review processes."

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/claims/health",
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
    const { fetchBlitzpayOrgReportingSnapshot } = await import("@/lib/blitzpay/blitzpay-reporting-snapshot")
    const snap = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, {
      sinceIso,
      skipMultiEntity: true,
      skipSupplierNetwork: true,
      skipClaimsWarranty: true,
      skipMobilePhase6a: true,
    })
    const { phase5c } = await buildClaimsProtectionHealthPayload(admin, organizationId, snap)
    return NextResponse.json({ disclaimer: DISCLAIMER, sinceIso, phase5c })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/claims/health", e)
  }
}
