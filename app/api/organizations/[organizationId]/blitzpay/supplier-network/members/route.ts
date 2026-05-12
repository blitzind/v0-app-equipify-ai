import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  addSupplierNetworkMember,
  assertSupplierNetworkVisibleToOrganization,
  listSupplierNetworkMembersVisible,
} from "@/lib/blitzpay/blitzpay-supplier-network"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MEMBER_ROLES = new Set(["owner", "manager", "participant", "observer"])

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/supplier-network/members",
  )
  if (schemaResp) return schemaResp
  let supplierNetworkId: string | null = null
  try {
    const u = new URL(request.url)
    supplierNetworkId = u.searchParams.get("supplier_network_id")
  } catch {
    /* ignore */
  }
  if (!supplierNetworkId || !UUID_RE.test(supplierNetworkId)) {
    return NextResponse.json({ error: "bad_request", message: "supplier_network_id query parameter is required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await assertSupplierNetworkVisibleToOrganization(admin, organizationId, supplierNetworkId)
    const members = await listSupplierNetworkMembersVisible(admin, supplierNetworkId)
    return NextResponse.json({ members })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "supplier_network_forbidden" || msg === "supplier_network_not_found") {
      return NextResponse.json({ error: "forbidden", message: "Network is not visible for this organization." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("GET blitzpay/supplier-network/members", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/supplier-network/members",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const supplier_network_id = String(body.supplier_network_id ?? "").trim()
  const member_organization_id = String(body.member_organization_id ?? body.organization_id ?? "").trim()
  const membership_role = String(body.membership_role ?? "").trim()
  if (!UUID_RE.test(supplier_network_id) || !UUID_RE.test(member_organization_id) || !MEMBER_ROLES.has(membership_role)) {
    return NextResponse.json(
      { error: "bad_request", message: "supplier_network_id, member_organization_id, and membership_role are required." },
      { status: 400 },
    )
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const member = await addSupplierNetworkMember(admin, organizationId, {
      supplier_network_id,
      member_organization_id,
      membership_role,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ member })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "supplier_network_anchor_required") {
      return NextResponse.json(
        { error: "forbidden", message: "Only the anchor organization may add members to this network." },
        { status: 403 },
      )
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/supplier-network/members", e)
  }
}
