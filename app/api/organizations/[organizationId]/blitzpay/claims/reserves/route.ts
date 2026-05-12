import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_CLAIMS_RESERVE_CAP, createWarrantyReserve } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { ensureBlitzpayDefaultClaimsAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RESERVE_TYPES = new Set(["workmanship", "equipment", "parts", "labor", "storm_response", "custom"])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/claims/reserves",
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
      .from("blitzpay_warranty_reserves")
      .select(
        "id, organization_id, reserve_status, reserve_type, reserve_name, reserve_balance_cents, projected_exposure_cents, reserve_utilization_rate, linked_account_id, metadata, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_RESERVE_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ reserves: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/claims/reserves", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/claims/reserves",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const reserve_name = String(body.reserve_name ?? "").trim()
  const reserve_type = String(body.reserve_type ?? "").trim()
  if (!reserve_name || !RESERVE_TYPES.has(reserve_type)) {
    return NextResponse.json({ error: "bad_request", message: "reserve_name and reserve_type are required." }, { status: 400 })
  }
  const linked_account_id = body.linked_account_id != null ? String(body.linked_account_id).trim() : null
  if (linked_account_id && !UUID_RE.test(linked_account_id)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid linked_account_id." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await ensureBlitzpayDefaultClaimsAccounts(admin, organizationId).catch(() => {})
    const reserve = await createWarrantyReserve(admin, organizationId, {
      reserve_name,
      reserve_type,
      reserve_balance_cents: body.reserve_balance_cents != null ? Math.round(Number(body.reserve_balance_cents)) : 0,
      projected_exposure_cents: body.projected_exposure_cents != null ? Math.round(Number(body.projected_exposure_cents)) : null,
      linked_account_id: linked_account_id && UUID_RE.test(linked_account_id) ? linked_account_id : null,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ reserve })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/claims/reserves", e)
  }
}
