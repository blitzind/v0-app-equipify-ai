import { NextResponse } from "next/server"
import { getPreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import {
  loadPreparedActionApprovalEvaluation,
  serializePreparedActionApproval,
} from "@/lib/aiden/actions/action-approval-policy"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { serializePreparedAction, UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; actionId: string }> },
) {
  const { organizationId, actionId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(actionId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const { data, error } = await getPreparedActionById(gate.supabase, organizationId, actionId)
  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "not_found", message: "Prepared action not found." }, { status: 404 })
  }

  const loaded = await loadPreparedActionApprovalEvaluation(gate.supabase, {
    organizationId,
    memberRoleRaw: gate.role,
    isPlatformAdmin: gate.isPlatformAdmin,
    permissions: gate.permissions,
    row: data,
  })
  if (loaded.error || !loaded.evaluation) {
    return NextResponse.json(
      { error: "approval_settings_unavailable", message: loaded.error?.message ?? "Could not evaluate approval." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    preparedAction: serializePreparedAction(data),
    approval: serializePreparedActionApproval(loaded.evaluation),
  })
}
