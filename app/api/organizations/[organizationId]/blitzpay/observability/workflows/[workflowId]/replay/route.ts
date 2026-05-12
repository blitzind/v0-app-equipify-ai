import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  hashBlitzpayObservabilityAuditEntry,
  validateBlitzpayManualReplayRequest,
  validateBlitzpayWorkflowReplayAuthorization,
} from "@/lib/blitzpay/blitzpay-workflow-orchestration"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

/**
 * Manual workflow replay (Phase 6B): owner/admin/platform-admin only; transitions use
 * `nextBlitzpayWorkflowStatus(..., "mark_replayed")` so completed rows cannot be rewritten — append-only governance.
 */
export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const GATE = ["canViewFinancialReports", "canViewFinancials"] as const

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; workflowId: string }> },
) {
  const { organizationId, workflowId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workflowId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...GATE])
  if ("error" in gate) return gate.error

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const replayAuth = validateBlitzpayWorkflowReplayAuthorization({
    orgMemberRole: gate.role,
    userEmail: user?.email,
  })
  if (!replayAuth.ok) {
    return NextResponse.json(
      { error: "forbidden", message: "Replay is limited to organization owners, admins, or platform operators." },
      { status: 403 },
    )
  }

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/observability/workflows/[workflowId]/replay",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  try {
    const { data: row, error: loadErr } = await admin
      .from("blitzpay_workflow_executions")
      .select("id, organization_id, execution_status, execution_attempts, max_attempts, workflow_type, execution_summary")
      .eq("id", workflowId)
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle()
    if (loadErr) throw new Error(loadErr.message)
    if (!row) {
      return NextResponse.json({ error: "not_found", message: "Workflow execution not found." }, { status: 404 })
    }
    const r = row as {
      id: string
      execution_status: string
      execution_attempts: number
      max_attempts: number
      workflow_type: string
      execution_summary: string | null
    }
    const vr = validateBlitzpayManualReplayRequest({
      currentStatus: r.execution_status,
    })
    if (!vr.ok) {
      return NextResponse.json({ error: vr.code, message: "Replay not allowed for this workflow state." }, { status: 409 })
    }

    const priorSummary = (r.execution_summary ?? "").slice(0, 400)
    const nextSummary = `manual_replay_marked:${new Date().toISOString()};prior:${priorSummary}`.slice(0, 2000)

    const { error: upErr } = await admin
      .from("blitzpay_workflow_executions")
      .update({
        execution_status: "replayed",
        completed_at: new Date().toISOString(),
        execution_summary: nextSummary,
        last_error: null,
      })
      .eq("id", workflowId)
      .eq("organization_id", organizationId)
    if (upErr) throw new Error(upErr.message)

    const pepper = process.env.BLITZPAY_OBSERVABILITY_AUDIT_PEPPER ?? ""
    const auditSummary = `Manual replay marked for workflow ${workflowId} (${r.workflow_type}).`
    const meta = { workflow_id: workflowId, workflow_type: r.workflow_type }
    const immutableHash = hashBlitzpayObservabilityAuditEntry({
      organizationId,
      auditType: "manual_replay",
      auditSummary,
      workflowExecutionId: workflowId,
      financialEventId: null,
      actorType: "admin",
      actorId: gate.userId,
      metadata: meta,
      pepper,
    })
    const { error: audErr } = await admin.from("blitzpay_observability_audit_log").insert({
      organization_id: organizationId,
      workflow_execution_id: workflowId,
      financial_event_id: null,
      audit_type: "manual_replay",
      actor_type: "admin",
      actor_id: gate.userId,
      audit_summary: auditSummary,
      immutable_hash: immutableHash,
      metadata: meta,
    })
    if (audErr) throw new Error(audErr.message)

    return NextResponse.json({
      ok: true,
      workflowId,
      execution_status: "replayed",
      message:
        "Replay state recorded for visibility. Downstream recovery steps still require explicit validation and approval in product workflows.",
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/observability/workflows/[id]/replay", e)
  }
}
