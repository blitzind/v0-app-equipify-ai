import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { runDeterministicTaxCalculation } from "@/lib/blitzpay/blitzpay-tax-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/tax/calculate",
  )
  if (schemaResp) return schemaResp
  let body: {
    taxableAmountCents?: number
    appliesTo?: string
    asOfYmd?: string
    jurisdictionId?: string | null
    persist?: boolean
    sourceType?: string
    sourceId?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  const appliesTo = String(body.appliesTo ?? "invoice").trim() || "invoice"
  const taxable = Math.round(Number(body.taxableAmountCents ?? 0))
  if (!Number.isFinite(taxable) || taxable < 0) {
    return NextResponse.json({ error: "bad_request", message: "taxableAmountCents must be a non-negative integer." }, { status: 400 })
  }
  if (body.persist && (!body.sourceType || !body.sourceId)) {
    return NextResponse.json(
      { error: "bad_request", message: "persist requires sourceType and sourceId (UUID)." },
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
    const result = await runDeterministicTaxCalculation(admin, organizationId, {
      taxableAmountCents: taxable,
      appliesTo,
      asOfYmd: body.asOfYmd,
      jurisdictionId: body.jurisdictionId ?? null,
      persist: Boolean(body.persist),
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ calculation: result })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/tax/calculate", e)
  }
}
