import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { PAYROLL_RUN_LIST_CAP, runDraftPayrollGeneration } from "@/lib/blitzpay/blitzpay-payroll-runs"
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
    "GET /api/organizations/[organizationId]/blitzpay/payroll-runs",
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
      .from("blitzpay_payroll_runs")
      .select(
        "id, organization_id, period_start, period_end, payroll_status, total_payout_cents, total_commission_cents, technician_count, processed_at",
      )
      .eq("organization_id", organizationId)
      .order("period_end", { ascending: false })
      .limit(PAYROLL_RUN_LIST_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({ runs: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
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
    "POST /api/organizations/[organizationId]/blitzpay/payroll-runs",
  )
  if (schemaResp) return schemaResp

  let body: { periodStart?: string; periodEnd?: string }
  try {
    body = (await request.json()) as { periodStart?: string; periodEnd?: string }
  } catch {
    return NextResponse.json({ error: "bad_request", message: "JSON body required." }, { status: 400 })
  }
  const periodStart = String(body.periodStart || "").slice(0, 10)
  const periodEnd = String(body.periodEnd || "").slice(0, 10)
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: "bad_request", message: "periodStart and periodEnd (YYYY-MM-DD) required." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const run = await runDraftPayrollGeneration(admin, { organizationId, periodStart, periodEnd })
    return NextResponse.json({ run })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}
