import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_PROTECTION_PLAN_CAP, createProtectionPlan } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { ensureBlitzpayDefaultClaimsAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PLAN_TYPES = new Set([
  "labor_protection",
  "equipment_protection",
  "maintenance_bundle",
  "extended_coverage",
  "storm_protection",
  "custom",
])

const PLAN_STATUSES = new Set(["active", "expired", "canceled", "archived"])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/protection-plans",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const { data, error } = await admin
      .from("blitzpay_equipment_protection_plans")
      .select(
        "id, organization_id, plan_status, plan_type, coverage_start_date, coverage_end_date, monthly_price_cents, deductible_amount_cents, estimated_exposure_cents, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_PROTECTION_PLAN_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ plans: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/protection-plans", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/protection-plans",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const plan_type = String(body.plan_type ?? "").trim()
  if (!PLAN_TYPES.has(plan_type)) {
    return NextResponse.json({ error: "bad_request", message: "plan_type is required." }, { status: 400 })
  }
  const plan_status = body.plan_status != null ? String(body.plan_status).trim() : "active"
  if (!PLAN_STATUSES.has(plan_status)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid plan_status." }, { status: 400 })
  }
  const optUuid = (v: unknown) => {
    const s = v != null ? String(v).trim() : ""
    return s && UUID_RE.test(s) ? s : null
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await ensureBlitzpayDefaultClaimsAccounts(admin, organizationId).catch(() => {})
    const row = await createProtectionPlan(admin, organizationId, {
      plan_type,
      plan_status,
      monthly_price_cents: body.monthly_price_cents != null ? Math.round(Number(body.monthly_price_cents)) : null,
      estimated_exposure_cents: body.estimated_exposure_cents != null ? Math.round(Number(body.estimated_exposure_cents)) : null,
      customer_id: optUuid(body.customer_id),
      equipment_id: optUuid(body.equipment_id),
      linked_membership_id: optUuid(body.linked_membership_id),
      actorUserId: gate.userId,
    })
    return NextResponse.json({ plan: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/protection-plans", e)
  }
}
