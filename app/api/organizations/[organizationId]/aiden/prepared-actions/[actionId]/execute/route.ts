import { NextResponse } from "next/server"
import { enforcePreparedActionApproval } from "@/lib/aiden/actions/action-approval-policy"
import { getPreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import { getPreparedWorkspaceActionDefinition, isFinancialAidenAction } from "@/lib/aiden/actions/action-registry"
import {
  assertAidenActionsEnabled,
  assertFinancialActionAllowedForTechnician,
  canPrepareWorkspaceActionForUser,
  getServiceRoleOrNull,
  isPreparedWorkspaceActionId,
  requireWorkspacePreparedActionPermissions,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { executePreparedWorkspaceAction } from "@/lib/aiden/prepared-actions/execute-prepared-workspace-action"

export const runtime = "nodejs"

export async function POST(
  request: Request,
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

  const enabled = await assertAidenActionsEnabled(gate.supabase, organizationId)
  if (enabled !== true) return enabled.error

  if (!isPreparedWorkspaceActionId(row.action_id)) {
    return NextResponse.json({ error: "unknown_action", message: "Unknown action on row." }, { status: 400 })
  }

  const def = getPreparedWorkspaceActionDefinition(row.action_id)
  if (!def) {
    return NextResponse.json({ error: "unknown_action", message: "Unknown action on row." }, { status: 400 })
  }

  if (row.status === "canceled" || row.status === "failed" || row.status === "completed") {
    return NextResponse.json({ error: "invalid_state", message: "This prepared action cannot be executed." }, { status: 409 })
  }

  if (row.status !== "confirmed") {
    return NextResponse.json(
      { error: "not_confirmed", message: "Confirm this action before executing it." },
      { status: 409 },
    )
  }

  const techOk = assertFinancialActionAllowedForTechnician(gate.permissions, row.action_id)
  if (techOk !== true) return techOk.error

  const canPrepare = await canPrepareWorkspaceActionForUser({
    supabase: gate.supabase,
    organizationId,
    permissions: gate.permissions,
    actionId: row.action_id,
    isPlatformAdmin: gate.isPlatformAdmin,
  })
  if (!canPrepare) {
    return NextResponse.json(
      { error: "insufficient_permissions", message: "You do not have permission to execute this action." },
      { status: 403 },
    )
  }

  if (isFinancialAidenAction(def)) {
    const still = await canPrepareWorkspaceActionForUser({
      supabase: gate.supabase,
      organizationId,
      permissions: gate.permissions,
      actionId: row.action_id,
      isPlatformAdmin: gate.isPlatformAdmin,
    })
    if (!still) {
      return NextResponse.json(
        { error: "insufficient_permissions", message: "Financial action permissions failed re-check." },
        { status: 403 },
      )
    }
  }

  const executeGate = await enforcePreparedActionApproval({
    supabase: gate.supabase,
    svc,
    organizationId,
    preparedActionId: actionId,
    actorUserId: gate.userId,
    actionId: row.action_id,
    memberRoleRaw: gate.role,
    isPlatformAdmin: gate.isPlatformAdmin,
    permissions: gate.permissions,
    row,
    decisionPhase: "execute",
  })
  if (!executeGate.ok) return executeGate.response

  let bulkConfirmationPhrase: string | undefined
  try {
    const raw = await request.json().catch(() => ({}))
    if (raw && typeof raw === "object" && typeof (raw as { bulkConfirmationPhrase?: unknown }).bulkConfirmationPhrase === "string") {
      bulkConfirmationPhrase = (raw as { bulkConfirmationPhrase: string }).bulkConfirmationPhrase
    }
  } catch {
    /* ignore */
  }

  return executePreparedWorkspaceAction({
    svc,
    userSupabase: gate.supabase,
    organizationId,
    userId: gate.userId,
    permissions: gate.permissions,
    preparedActionId: actionId,
    actionId: row.action_id,
    bulkConfirmationPhrase,
    platformAdminPlanBypass: gate.isPlatformAdmin,
  })
}
