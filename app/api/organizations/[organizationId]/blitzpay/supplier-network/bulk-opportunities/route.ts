import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createBulkPurchaseOpportunity, listVisibleSupplierNetworksForOrganization } from "@/lib/blitzpay/blitzpay-supplier-network"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const TYPES = new Set(["inventory", "equipment", "materials", "fleet", "consumables", "custom"])

const LIST_CAP = 30

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/supplier-network/bulk-opportunities",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const networks = await listVisibleSupplierNetworksForOrganization(admin, organizationId)
    const networkIds = networks.map((n) => n.id).sort((a, b) => a.localeCompare(b))
    if (!networkIds.length) return NextResponse.json({ opportunities: [] })
    const { data, error } = await admin
      .from("blitzpay_bulk_purchase_opportunities")
      .select("*")
      .in("supplier_network_id", networkIds)
      .order("id", { ascending: true })
      .limit(LIST_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ opportunities: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/supplier-network/bulk-opportunities", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/supplier-network/bulk-opportunities",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const supplier_network_id = String(body.supplier_network_id ?? "").trim()
  const opportunity_type = String(body.opportunity_type ?? "").trim()
  if (!UUID_RE.test(supplier_network_id) || !TYPES.has(opportunity_type)) {
    return NextResponse.json({ error: "bad_request", message: "supplier_network_id and opportunity_type are required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const opportunity = await createBulkPurchaseOpportunity(admin, organizationId, {
      supplier_network_id,
      opportunity_type,
      estimated_total_volume_cents:
        body.estimated_total_volume_cents != null ? Math.round(Number(body.estimated_total_volume_cents)) : null,
      estimated_savings_cents: body.estimated_savings_cents != null ? Math.round(Number(body.estimated_savings_cents)) : null,
      participating_organization_count:
        body.participating_organization_count != null ? Math.round(Number(body.participating_organization_count)) : null,
      expiration_date: body.expiration_date != null ? String(body.expiration_date) : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ opportunity })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "supplier_network_anchor_required") {
      return NextResponse.json({ error: "forbidden", message: "Only the anchor organization may create bulk opportunities." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/supplier-network/bulk-opportunities", e)
  }
}
