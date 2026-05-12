import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  createRevenueOptimizationExperiment,
  fetchRevenueOptimizationExperiments,
} from "@/lib/blitzpay/blitzpay-revenue-optimization-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EXPERIMENT_TYPES = new Set([
  "reminder_timing",
  "membership_pricing",
  "recovery_sequence",
  "ach_nudge",
  "renewal_timing",
  "customer_segment",
  "custom",
])

const EXPERIMENT_STATUSES = new Set(["draft", "active", "paused", "completed", "archived"])

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/revenue-optimization/experiments",
  )
  if (schemaResp) return schemaResp

  let limit = 30
  try {
    const u = new URL(request.url)
    const raw = u.searchParams.get("limit")
    if (raw != null) limit = Number(raw)
  } catch {
    /* ignore */
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const experiments = await fetchRevenueOptimizationExperiments(admin, organizationId, limit)
    return NextResponse.json({ experiments })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/revenue-optimization/experiments", e)
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/revenue-optimization/experiments",
  )
  if (schemaResp) return schemaResp

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const experiment_name = String(body.experiment_name ?? "").trim()
  const experiment_type = String(body.experiment_type ?? "").trim()
  if (!experiment_name || !EXPERIMENT_TYPES.has(experiment_type)) {
    return NextResponse.json(
      { error: "bad_request", message: "experiment_name and a valid experiment_type are required." },
      { status: 400 },
    )
  }

  const experiment_status = body.experiment_status != null ? String(body.experiment_status) : "draft"
  if (!EXPERIMENT_STATUSES.has(experiment_status)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid experiment_status." }, { status: 400 })
  }

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null)

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const id = await createRevenueOptimizationExperiment(
      admin,
      organizationId,
      {
        experiment_name,
        experiment_type,
        experiment_status,
        start_date: body.start_date != null ? String(body.start_date) : null,
        end_date: body.end_date != null ? String(body.end_date) : null,
        control_strategy: body.control_strategy != null ? String(body.control_strategy) : null,
        treatment_strategy: body.treatment_strategy != null ? String(body.treatment_strategy) : null,
        success_metric: body.success_metric != null ? String(body.success_metric) : null,
        baseline_value: num(body.baseline_value),
        observed_value: num(body.observed_value),
        estimated_lift_basis_points: num(body.estimated_lift_basis_points),
        metadata:
          body.metadata != null && typeof body.metadata === "object" && !Array.isArray(body.metadata)
            ? (body.metadata as Record<string, unknown>)
            : {},
      },
      { actorType: "user", actorId: gate.userId },
    )
    return NextResponse.json({ ok: true, id })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/revenue-optimization/experiments", e)
  }
}
