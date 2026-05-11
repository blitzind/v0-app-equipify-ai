import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  blitzpayStaffLoadFailedResponse,
  blitzpayStaffOperationFailedResponse,
} from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { CASH_RESERVE_RULES_CAP, insertBlitzpayCashReserveRule } from "@/lib/blitzpay/blitzpay-cash-accounts-service"
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

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/cash-reserve-rules",
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
      .from("blitzpay_cash_reserve_rules")
      .select("id, organization_id, rule_name, rule_type, basis_points, fixed_amount_cents, active, metadata, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(CASH_RESERVE_RULES_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ rules: data ?? [] })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET cash-reserve-rules", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/cash-reserve-rules",
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
  const ruleName = String(body.ruleName || "").trim()
  const ruleType = String(body.ruleType || "").trim()
  if (!ruleName || !ruleType || !RULE_TYPES.has(ruleType)) {
    return NextResponse.json({ error: "bad_request", message: "ruleName and valid ruleType required." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const rule = await insertBlitzpayCashReserveRule(admin, organizationId, {
      ruleName,
      ruleType,
      basisPoints: body.basisPoints,
      fixedAmountCents: body.fixedAmountCents,
      active: body.active,
      metadata: body.metadata,
    })
    return NextResponse.json({ rule })
  } catch (e) {
    return blitzpayStaffOperationFailedResponse("POST cash-reserve-rules", e, "insert_failed", 500)
  }
}
