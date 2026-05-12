import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_SUPPLIER_NETWORK_BENCHMARK_CAP, listVisibleSupplierNetworksForOrganization } from "@/lib/blitzpay/blitzpay-supplier-network"
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
    "GET /api/organizations/[organizationId]/blitzpay/supplier-network/benchmarks",
  )
  if (schemaResp) return schemaResp
  let limit = BLITZPAY_SUPPLIER_NETWORK_BENCHMARK_CAP
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("limit")
    if (raw != null) limit = Math.min(BLITZPAY_SUPPLIER_NETWORK_BENCHMARK_CAP, Math.max(1, Math.round(Number(raw))))
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
    const networks = await listVisibleSupplierNetworksForOrganization(admin, organizationId)
    const networkIds = networks.map((n) => n.id).sort((a, b) => a.localeCompare(b))
    if (!networkIds.length) return NextResponse.json({ benchmarks: [] })
    const { data, error } = await admin
      .from("blitzpay_shared_procurement_benchmarks")
      .select("id, supplier_network_id, benchmark_type, benchmark_period, benchmark_score, benchmark_summary, supporting_metrics, metadata, created_at")
      .in("supplier_network_id", networkIds)
      .order("id", { ascending: true })
      .limit(limit)
    if (error) throw new Error(error.message)
    return NextResponse.json({ benchmarks: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/supplier-network/benchmarks", e)
  }
}
