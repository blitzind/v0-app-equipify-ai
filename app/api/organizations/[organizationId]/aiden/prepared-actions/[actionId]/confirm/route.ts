import { NextResponse } from "next/server"
import { z } from "zod"
import { enforcePreparedActionApproval } from "@/lib/aiden/actions/action-approval-policy"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { getPreparedActionById, updatePreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import { getPreparedWorkspaceActionDefinition, isFinancialAidenAction } from "@/lib/aiden/actions/action-registry"
import {
  assertAidenActionsEnabled,
  assertFinancialActionAllowedForTechnician,
  canPrepareWorkspaceActionForUser,
  getServiceRoleOrNull,
  isPreparedWorkspaceActionId,
  requireWorkspacePreparedActionPermissions,
  serializePreparedAction,
  UUID_RE,
} from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { executePreparedWorkspaceAction } from "@/lib/aiden/prepared-actions/execute-prepared-workspace-action"

export const runtime = "nodejs"

const BodySchema = z.object({
  execute: z.boolean().optional(),
  bulkConfirmationPhrase: z.string().optional(),
})

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
      { error: "insufficient_permissions", message: "You no longer have permission to confirm this action." },
      { status: 403 },
    )
  }

  const def = getPreparedWorkspaceActionDefinition(row.action_id)
  if (def && isFinancialAidenAction(def)) {
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

  let body: z.infer<typeof BodySchema> = {}
  try {
    const raw = await request.json().catch(() => ({}))
    body = BodySchema.parse(raw)
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  if (row.status === "confirmed") {
    if (body.execute) {
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
      return executePreparedWorkspaceAction({
        svc,
        userSupabase: gate.supabase,
        organizationId,
        userId: gate.userId,
        permissions: gate.permissions,
        preparedActionId: actionId,
        actionId: row.action_id,
        bulkConfirmationPhrase: body.bulkConfirmationPhrase,
        platformAdminPlanBypass: gate.isPlatformAdmin,
      })
    }
    const fresh = await getPreparedActionById(svc, organizationId, actionId)
    return NextResponse.json({
      preparedAction: fresh.data ? serializePreparedAction(fresh.data) : serializePreparedAction(row),
    })
  }

  if (row.status === "canceled" || row.status === "failed" || row.status === "completed") {
    return NextResponse.json({ error: "invalid_state", message: "This prepared action cannot be confirmed." }, { status: 409 })
  }

  if (row.status === "needs_clarification") {
    return NextResponse.json(
      { error: "needs_clarification", message: "Resolve missing fields before confirming this action." },
      { status: 409 },
    )
  }

  if (row.status !== "ready_for_confirmation" && row.status !== "prepared") {
    return NextResponse.json({ error: "invalid_state", message: "This prepared action is not awaiting confirmation." }, { status: 409 })
  }

  const confirmGate = await enforcePreparedActionApproval({
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
    decisionPhase: "confirm",
  })
  if (!confirmGate.ok) return confirmGate.response

  const now = new Date().toISOString()
  const upd = await updatePreparedActionById(svc, organizationId, actionId, {
    status: "confirmed",
    confirmed_by: gate.userId,
    confirmed_at: now,
  })
  if (upd.error || !upd.data) {
    return NextResponse.json({ error: "update_failed", message: upd.error?.message ?? "Update failed." }, { status: 500 })
  }

  const audit = await insertActionAuditLog(svc, {
    organization_id: organizationId,
    prepared_action_id: actionId,
    actor_user_id: gate.userId,
    event_type: "prepared_action_confirmed",
    action_id: row.action_id,
    details: {},
  })
  if (audit.error) {
    return NextResponse.json({ error: "audit_failed", message: audit.error.message }, { status: 500 })
  }

  if (body.execute) {
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
      row: upd.data,
      decisionPhase: "execute",
    })
    if (!executeGate.ok) return executeGate.response
    return executePreparedWorkspaceAction({
      svc,
      userSupabase: gate.supabase,
      organizationId,
      userId: gate.userId,
      permissions: gate.permissions,
      preparedActionId: actionId,
      actionId: row.action_id,
      bulkConfirmationPhrase: body.bulkConfirmationPhrase,
      platformAdminPlanBypass: gate.isPlatformAdmin,
    })
  }

  return NextResponse.json({ preparedAction: serializePreparedAction(upd.data) })
}
