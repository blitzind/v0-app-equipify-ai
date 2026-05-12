import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { sanitizeBlitzpayObservabilityJson } from "@/lib/blitzpay/blitzpay-observability"
import { BLITZPAY_WORKFLOW_LIST_CAP } from "@/lib/blitzpay/blitzpay-workflow-orchestration"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GATE = ["canViewFinancialReports", "canViewFinancials"] as const

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/observability/workflows",
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
      .from("blitzpay_workflow_executions")
      .select(
        "id, workflow_type, execution_status, related_entity_type, related_entity_id, idempotency_key, execution_attempts, max_attempts, execution_summary, last_error, started_at, completed_at, metadata, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(BLITZPAY_WORKFLOW_LIST_CAP)
    if (error) throw new Error(error.message)
    const items = (data ?? []).map((r) => {
      const row = r as Record<string, unknown>
      return {
        ...row,
        metadata: sanitizeBlitzpayObservabilityJson((row.metadata as Record<string, unknown>) ?? {}),
      }
    })
    return NextResponse.json({ items })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/observability/workflows", e)
  }
}
