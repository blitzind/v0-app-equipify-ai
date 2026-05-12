import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  assertGroupVisibleToOrganization,
  createIntercompanyBalance,
  listIntercompanyBalancesForGroupIds,
  listVisibleFinancialGroupsForOrganization,
} from "@/lib/blitzpay/blitzpay-multi-entity-finance"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BALANCE_TYPES = new Set([
  "payable",
  "receivable",
  "allocation",
  "reimbursement",
  "payroll_share",
  "treasury_share",
])

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/multi-entity/intercompany-balances",
  )
  if (schemaResp) return schemaResp
  let filterGroupId: string | null = null
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("financial_group_id")
    if (raw && UUID_RE.test(raw)) filterGroupId = raw
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
    if (filterGroupId) {
      await assertGroupVisibleToOrganization(admin, organizationId, filterGroupId)
      const balances = await listIntercompanyBalancesForGroupIds(admin, [filterGroupId])
      return NextResponse.json({ balances })
    }
    const groups = await listVisibleFinancialGroupsForOrganization(admin, organizationId)
    const groupIds = groups.map((g) => g.id).sort((a, b) => a.localeCompare(b))
    const balances = await listIntercompanyBalancesForGroupIds(admin, groupIds)
    return NextResponse.json({ balances })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "multi_entity_forbidden" || msg === "multi_entity_group_not_found") {
      return NextResponse.json({ error: "forbidden", message: "Group is not visible for this organization." }, { status: 403 })
    }
    return blitzpayStaffLoadFailedResponse("GET blitzpay/multi-entity/intercompany-balances", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/multi-entity/intercompany-balances",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const financial_group_id = String(body.financial_group_id ?? "").trim()
  const source_organization_id = String(body.source_organization_id ?? "").trim()
  const target_organization_id = String(body.target_organization_id ?? "").trim()
  const balance_type = String(body.balance_type ?? "").trim()
  const balance_amount_cents = Number(body.balance_amount_cents ?? 0)
  if (
    !UUID_RE.test(financial_group_id) ||
    !UUID_RE.test(source_organization_id) ||
    !UUID_RE.test(target_organization_id) ||
    !BALANCE_TYPES.has(balance_type)
  ) {
    return NextResponse.json(
      { error: "bad_request", message: "financial_group_id, source_organization_id, target_organization_id, and balance_type are required." },
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
    const row = await createIntercompanyBalance(admin, organizationId, {
      financial_group_id,
      source_organization_id,
      target_organization_id,
      balance_type,
      balance_amount_cents,
      originating_entry_reference: body.originating_entry_reference != null ? String(body.originating_entry_reference) : null,
      settlement_due_date: body.settlement_due_date != null ? String(body.settlement_due_date) : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ balance: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "multi_entity_anchor_required") {
      return NextResponse.json({ error: "forbidden", message: "Only the anchor organization may record inter-company balances." }, { status: 403 })
    }
    if (msg === "multi_entity_ic_distinct_orgs_required") {
      return NextResponse.json({ error: "bad_request", message: "Source and target organizations must differ." }, { status: 400 })
    }
    return blitzpayStaffLoadFailedResponse("POST blitzpay/multi-entity/intercompany-balances", e)
  }
}
