import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { sanitizeBlitzpayObservabilityJson } from "@/lib/blitzpay/blitzpay-observability"
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
    "GET /api/organizations/[organizationId]/blitzpay/observability/queue-health",
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
      .from("blitzpay_queue_health_snapshots")
      .select(
        "id, snapshot_scope, queue_depth, failed_execution_count, replay_pending_count, avg_processing_latency_ms, idempotency_conflict_count, worker_health_score, metadata, created_at",
      )
      .eq("organization_id", organizationId)
      .eq("snapshot_scope", "org")
      .order("created_at", { ascending: false })
      .limit(12)
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
    return blitzpayStaffLoadFailedResponse("GET blitzpay/observability/queue-health", e)
  }
}
