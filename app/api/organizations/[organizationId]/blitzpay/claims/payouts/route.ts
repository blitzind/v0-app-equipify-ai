import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_CLAIMS_PAYOUT_CAP, createClaimsPayoutTracking } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { ensureBlitzpayDefaultClaimsAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PAYOUT_TYPES = new Set(["reimbursement", "vendor_payment", "customer_credit", "warranty_offset", "custom"])

const PAYOUT_STATUSES = new Set(["pending", "scheduled", "processing", "completed", "reversed", "canceled"])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/claims/payouts",
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
      .from("blitzpay_claims_payout_tracking")
      .select("id, organization_id, claim_id, payout_status, payout_type, payout_amount_cents, payout_reference_hash, payout_date, created_at")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_PAYOUT_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ payouts: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/claims/payouts", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/claims/payouts",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const claim_id = String(body.claim_id ?? "").trim()
  const payout_type = String(body.payout_type ?? "").trim()
  if (!UUID_RE.test(claim_id) || !PAYOUT_TYPES.has(payout_type)) {
    return NextResponse.json({ error: "bad_request", message: "claim_id and payout_type are required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await ensureBlitzpayDefaultClaimsAccounts(admin, organizationId).catch(() => {})
    const payoutStatusRaw = body.payout_status != null ? String(body.payout_status).trim() : null
    if (payoutStatusRaw && !PAYOUT_STATUSES.has(payoutStatusRaw)) {
      return NextResponse.json({ error: "bad_request", message: "Invalid payout_status." }, { status: 400 })
    }
    const payout = await createClaimsPayoutTracking(admin, organizationId, {
      claim_id,
      payout_type,
      payout_amount_cents: Math.max(0, Math.round(Number(body.payout_amount_cents ?? 0))),
      payout_status: payoutStatusRaw ?? undefined,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ payout })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/claims/payouts", e)
  }
}
