import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createSupplierNetwork, listVisibleSupplierNetworksForOrganization } from "@/lib/blitzpay/blitzpay-supplier-network"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const NETWORK_TYPES = new Set([
  "procurement_group",
  "supplier_coop",
  "franchise_network",
  "preferred_vendor_network",
  "financing_network",
  "custom",
])

const VISIBILITY = new Set(["private", "invited", "shared"])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/supplier-network/networks",
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
    return NextResponse.json({ networks })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/supplier-network/networks", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/supplier-network/networks",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const network_name = String(body.network_name ?? "").trim()
  const network_type = String(body.network_type ?? "").trim()
  const visibility_scope = body.visibility_scope != null ? String(body.visibility_scope).trim() : "private"
  if (!network_name || !NETWORK_TYPES.has(network_type)) {
    return NextResponse.json({ error: "bad_request", message: "network_name and a valid network_type are required." }, { status: 400 })
  }
  if (!VISIBILITY.has(visibility_scope)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid visibility_scope." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const network = await createSupplierNetwork(admin, organizationId, {
      network_name,
      network_type,
      visibility_scope,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ network })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/supplier-network/networks", e)
  }
}
