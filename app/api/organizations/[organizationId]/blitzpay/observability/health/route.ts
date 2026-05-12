import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  buildPhase6bObservabilityReportingSlice,
  fetchBlitzpayObservabilityAuditTail,
  summarizeBlitzpayObservabilityHealth,
} from "@/lib/blitzpay/blitzpay-observability"
import { validateBlitzpayWorkflowReplayAuthorization } from "@/lib/blitzpay/blitzpay-workflow-orchestration"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GATE = ["canViewFinancialReports", "canViewFinancials"] as const

const DISCLAIMER =
  "Observability and replay tooling support operational visibility and controlled recovery workflows. Financial actions remain subject to validation and approval safeguards."

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...GATE])
  if ("error" in gate) return gate.error
  const supabase = gate.supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const replayAuthorized = validateBlitzpayWorkflowReplayAuthorization({
    orgMemberRole: gate.role,
    userEmail: user?.email,
  }).ok
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/observability/health",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const [phase6b, auditTail] = await Promise.all([
      buildPhase6bObservabilityReportingSlice(admin, organizationId),
      fetchBlitzpayObservabilityAuditTail(admin, organizationId),
    ])
    const summary = summarizeBlitzpayObservabilityHealth(phase6b)
    return NextResponse.json({
      disclaimer: DISCLAIMER,
      phase6b,
      reportingPhase6b: phase6b,
      summary,
      auditTail,
      replayAuthorized,
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/observability/health", e)
  }
}
