import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_STORM_EVENT_CAP, createStormEventFinancial } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { ensureBlitzpayDefaultClaimsAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EVENT_STATUSES = new Set(["active", "monitoring", "completed", "archived"])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/storm-events",
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
      .from("blitzpay_storm_event_financials")
      .select(
        "id, organization_id, event_status, event_name, event_region, estimated_revenue_opportunity_cents, estimated_claim_exposure_cents, estimated_response_cost_cents, estimated_treasury_pressure, event_start_date, event_end_date, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_STORM_EVENT_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ stormEvents: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/storm-events", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/storm-events",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const event_name = String(body.event_name ?? "").trim()
  if (!event_name) {
    return NextResponse.json({ error: "bad_request", message: "event_name is required." }, { status: 400 })
  }
  const event_status = body.event_status != null ? String(body.event_status).trim() : "active"
  if (!EVENT_STATUSES.has(event_status)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid event_status." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await ensureBlitzpayDefaultClaimsAccounts(admin, organizationId).catch(() => {})
    const row = await createStormEventFinancial(admin, organizationId, {
      event_name,
      event_region: body.event_region != null ? String(body.event_region) : null,
      event_status,
      estimated_revenue_opportunity_cents:
        body.estimated_revenue_opportunity_cents != null ? Math.round(Number(body.estimated_revenue_opportunity_cents)) : null,
      estimated_claim_exposure_cents:
        body.estimated_claim_exposure_cents != null ? Math.round(Number(body.estimated_claim_exposure_cents)) : null,
      estimated_response_cost_cents:
        body.estimated_response_cost_cents != null ? Math.round(Number(body.estimated_response_cost_cents)) : null,
      estimated_treasury_pressure: body.estimated_treasury_pressure != null ? Math.round(Number(body.estimated_treasury_pressure)) : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ stormEvent: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/storm-events", e)
  }
}
