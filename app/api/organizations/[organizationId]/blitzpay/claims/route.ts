import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { BLITZPAY_CLAIMS_LIST_CAP, createClaim, prioritizeClaimsDeterministic } from "@/lib/blitzpay/blitzpay-claims-orchestration"
import { ensureBlitzpayDefaultClaimsAccounts } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CLAIM_TYPES = new Set([
  "warranty",
  "storm",
  "equipment_failure",
  "protection_plan",
  "insurance",
  "reimbursement",
  "custom",
])

const CLAIM_STATUSES = new Set([
  "draft",
  "submitted",
  "reviewing",
  "approved",
  "partially_approved",
  "denied",
  "settled",
  "archived",
])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse("GET /api/organizations/[organizationId]/blitzpay/claims")
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const { data, error } = await admin
      .from("blitzpay_claims")
      .select(
        "id, organization_id, claim_status, claim_type, claim_reference, estimated_claim_amount_cents, approved_claim_amount_cents, payout_amount_cents, deductible_amount_cents, claim_event_date, submitted_at, resolved_at, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_CLAIMS_LIST_CAP)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<{
      id: string
      claim_status: string
      estimated_claim_amount_cents: number | null
      submitted_at: string | null
    }>
    const prioritized = prioritizeClaimsDeterministic(rows)
    return NextResponse.json({ claims: prioritized })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/claims", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse("POST /api/organizations/[organizationId]/blitzpay/claims")
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const claim_reference = String(body.claim_reference ?? "").trim()
  const claim_type = String(body.claim_type ?? "").trim()
  const claim_status = body.claim_status != null ? String(body.claim_status).trim() : "draft"
  if (!claim_reference || !CLAIM_TYPES.has(claim_type)) {
    return NextResponse.json({ error: "bad_request", message: "claim_reference and claim_type are required." }, { status: 400 })
  }
  if (!CLAIM_STATUSES.has(claim_status)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid claim_status." }, { status: 400 })
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
    const claim = await createClaim(admin, organizationId, {
      claim_reference,
      claim_type,
      claim_status,
      estimated_claim_amount_cents: body.estimated_claim_amount_cents != null ? Math.round(Number(body.estimated_claim_amount_cents)) : null,
      customer_id: optUuid(body.customer_id),
      equipment_id: optUuid(body.equipment_id),
      linked_invoice_id: optUuid(body.linked_invoice_id),
      linked_work_order_id: optUuid(body.linked_work_order_id),
      actorUserId: gate.userId,
    })
    return NextResponse.json({ claim })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/claims", e)
  }
}
