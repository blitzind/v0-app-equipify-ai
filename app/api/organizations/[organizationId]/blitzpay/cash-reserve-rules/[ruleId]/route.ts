import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { updateBlitzpayCashReserveRule } from "@/lib/blitzpay/blitzpay-cash-accounts-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RULE_TYPES = new Set([
  "percent_of_collections",
  "fixed_monthly_reserve",
  "payroll_liability",
  "vendor_ap_pressure",
  "dispute_risk",
  "tax_estimate",
])

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; ruleId: string }> },
) {
  const { organizationId, ruleId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(ruleId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "PATCH /api/organizations/[organizationId]/blitzpay/cash-reserve-rules/[ruleId]",
  )
  if (schemaResp) return schemaResp

  let body: {
    ruleName?: string
    ruleType?: string
    basisPoints?: number | null
    fixedAmountCents?: number | null
    active?: boolean
    metadata?: Record<string, unknown>
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  if (body.ruleType != null && !RULE_TYPES.has(String(body.ruleType))) {
    return NextResponse.json({ error: "bad_request", message: "Invalid ruleType." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const rule = await updateBlitzpayCashReserveRule(admin, organizationId, ruleId, {
      ruleName: body.ruleName,
      ruleType: body.ruleType,
      basisPoints: body.basisPoints,
      fixedAmountCents: body.fixedAmountCents,
      active: body.active,
      metadata: body.metadata,
    })
    return NextResponse.json({ rule })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}
