import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createTaxRule, listTaxRules } from "@/lib/blitzpay/blitzpay-tax-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/tax/rules",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const rules = await listTaxRules(admin, organizationId)
    return NextResponse.json({ rules })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/tax/rules", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/tax/rules",
  )
  if (schemaResp) return schemaResp
  let body: {
    jurisdictionId?: string
    taxRuleName?: string
    taxRuleType?: string
    calculationMethod?: string
    rateBasisPoints?: number | null
    flatAmountCents?: number | null
    thresholdAmountCents?: number | null
    appliesTo?: string
    effectiveStartDate?: string
    effectiveEndDate?: string | null
    complianceStatus?: string
    metadata?: Record<string, unknown>
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  if (!body.jurisdictionId || !body.effectiveStartDate) {
    return NextResponse.json({ error: "bad_request", message: "jurisdictionId and effectiveStartDate required." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const row = await createTaxRule(admin, organizationId, {
      jurisdictionId: body.jurisdictionId,
      taxRuleName: String(body.taxRuleName ?? ""),
      taxRuleType: body.taxRuleType,
      calculationMethod: body.calculationMethod,
      rateBasisPoints: body.rateBasisPoints ?? null,
      flatAmountCents: body.flatAmountCents ?? null,
      thresholdAmountCents: body.thresholdAmountCents ?? null,
      appliesTo: body.appliesTo,
      effectiveStartDate: body.effectiveStartDate,
      effectiveEndDate: body.effectiveEndDate ?? null,
      complianceStatus: body.complianceStatus,
      metadata: body.metadata,
      actorUserId: gate.userId,
    })
    return NextResponse.json({ rule: row })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/tax/rules", e)
  }
}
