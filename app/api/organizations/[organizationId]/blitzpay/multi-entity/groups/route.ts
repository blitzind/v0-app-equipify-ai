import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { createFinancialGroup, listVisibleFinancialGroupsForOrganization } from "@/lib/blitzpay/blitzpay-multi-entity-finance"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GROUP_TYPES = new Set([
  "franchise",
  "holding_company",
  "regional_operator",
  "enterprise",
  "custom",
])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/multi-entity/groups",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
    return NextResponse.json({ groups })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/multi-entity/groups", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/multi-entity/groups",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const group_name = String(body.group_name ?? "").trim()
  const group_type = String(body.group_type ?? "").trim()
  const parent_group_id = body.parent_group_id != null ? String(body.parent_group_id).trim() : null
  if (!group_name || !GROUP_TYPES.has(group_type)) {
    return NextResponse.json({ error: "bad_request", message: "group_name and a valid group_type are required." }, { status: 400 })
  }
  if (parent_group_id && !UUID_RE.test(parent_group_id)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid parent_group_id." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const group = await createFinancialGroup(admin, organizationId, {
      group_name,
      group_type,
      parent_group_id: parent_group_id && UUID_RE.test(parent_group_id) ? parent_group_id : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ group })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/multi-entity/groups", e)
  }
}
