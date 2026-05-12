import { NextResponse } from "next/server"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { getPreparedActionById, updatePreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import {
  getServiceRoleOrNull,
  requireWorkspacePreparedActionPermissions,
  serializePreparedAction,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

const CANCELABLE = new Set(["prepared", "needs_clarification", "ready_for_confirmation", "confirmed"])

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; actionId: string }> },
) {
  const { organizationId, actionId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(actionId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const rowRes = await getPreparedActionById(svc, organizationId, actionId)
  if (rowRes.error) {
    return NextResponse.json({ error: "query_failed", message: rowRes.error.message }, { status: 500 })
  }
  const row = rowRes.data
  if (!row) {
    return NextResponse.json({ error: "not_found", message: "Prepared action not found." }, { status: 404 })
  }

  const gate = await requireWorkspacePreparedActionPermissions(organizationId, row.action_id)
  if ("error" in gate) return gate.error

  if (row.status === "canceled") {
    return NextResponse.json({ preparedAction: serializePreparedAction(row), canceled: true })
  }
  if (!CANCELABLE.has(row.status)) {
    return NextResponse.json(
      { error: "invalid_state", message: "This prepared action can no longer be canceled." },
      { status: 409 },
    )
  }

  const now = new Date().toISOString()
  const upd = await updatePreparedActionById(svc, organizationId, actionId, {
    status: "canceled",
    canceled_by: gate.userId,
    canceled_at: now,
  })
  if (upd.error || !upd.data) {
    return NextResponse.json({ error: "update_failed", message: upd.error?.message ?? "Update failed." }, { status: 500 })
  }

  const audit = await insertActionAuditLog(svc, {
    organization_id: organizationId,
    prepared_action_id: actionId,
    actor_user_id: gate.userId,
    event_type: "prepared_action_canceled",
    action_id: row.action_id,
    details: { previousStatus: row.status },
  })
  if (audit.error) {
    return NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 })
  }

  return NextResponse.json({ preparedAction: serializePreparedAction(upd.data) })
}
