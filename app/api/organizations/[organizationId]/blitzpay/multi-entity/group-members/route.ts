import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  addFinancialGroupMember,
  assertGroupVisibleToOrganization,
  listFinancialGroupMembersVisible,
} from "@/lib/blitzpay/blitzpay-multi-entity-finance"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MEMBER_ROLES = new Set(["parent", "child", "regional", "observer"])

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/multi-entity/group-members",
  )
  if (schemaResp) return schemaResp
  let financialGroupId: string | null = null
  try {
    const u = new URL(request.url)
    financialGroupId = u.searchParams.get("financial_group_id")
  } catch {
    /* ignore */
  }
  if (!financialGroupId || !UUID_RE.test(financialGroupId)) {
    return NextResponse.json({ error: "bad_request", message: "financial_group_id query parameter is required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await assertGroupVisibleToOrganization(admin, organizationId, financialGroupId)
    const members = await listFinancialGroupMembersVisible(admin, financialGroupId)
    return NextResponse.json({ members })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "multi_entity_forbidden" || msg === "multi_entity_group_not_found") {
      return NextResponse.json({ error: "forbidden", message: "Group is not visible for this organization." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("GET blitzpay/multi-entity/group-members", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/multi-entity/group-members",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const financial_group_id = String(body.financial_group_id ?? "").trim()
  const member_organization_id = String(body.organization_id ?? body.member_organization_id ?? "").trim()
  const membership_role = String(body.membership_role ?? "").trim()
  if (!UUID_RE.test(financial_group_id) || !UUID_RE.test(member_organization_id) || !MEMBER_ROLES.has(membership_role)) {
    return NextResponse.json(
      { error: "bad_request", message: "financial_group_id, organization_id, and membership_role are required." },
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
    const member = await addFinancialGroupMember(admin, organizationId, {
      financial_group_id,
      member_organization_id,
      membership_role,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ member })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "multi_entity_anchor_required") {
      return NextResponse.json(
        { error: "forbidden", message: "Only the anchor organization may modify group membership." },
        { status: 403 },
      )
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/multi-entity/group-members", e)
  }
}
