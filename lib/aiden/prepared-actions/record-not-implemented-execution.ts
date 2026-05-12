import "server-only"

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { insertActionAuditLog } from "@/lib/aiden/actions/action-audit-log"
import { getPreparedActionById } from "@/lib/aiden/actions/prepared-action-repository"
import { serializePreparedAction } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

/**
 * Records execution start + failure audit rows and returns **501** for workspace executors
 * that are not wired yet (invoice creation, etc.).
 */
export async function recordNotImplementedExecutionAndRespond(args: {
  svc: SupabaseClient
  organizationId: string
  userId: string
  preparedActionId: string
  actionId: string
}): Promise<NextResponse> {
  const auditStart = await insertActionAuditLog(args.svc, {
    organization_id: args.organizationId,
    prepared_action_id: args.preparedActionId,
    actor_user_id: args.userId,
    event_type: "prepared_action_execution_started",
    action_id: args.actionId,
    details: {},
  })
  if (auditStart.error) {
    return NextResponse.json({ error: "audit_failed", message: auditStart.error.message }, { status: 500 })
  }

  const auditFail = await insertActionAuditLog(args.svc, {
    organization_id: args.organizationId,
    prepared_action_id: args.preparedActionId,
    actor_user_id: args.userId,
    event_type: "prepared_action_execution_failed",
    action_id: args.actionId,
    details: { code: "not_implemented", message: "Execution is not implemented for this action yet." },
  })
  if (auditFail.error) {
    return NextResponse.json({ error: "audit_failed", message: auditFail.error.message }, { status: 500 })
  }

  const fresh = await getPreparedActionById(args.svc, args.organizationId, args.preparedActionId)
  const preparedAction = fresh.data ? serializePreparedAction(fresh.data) : null

  return NextResponse.json(
    {
      error: "not_implemented",
      message: "Execution is not implemented for this action yet.",
      preparedAction,
    },
    { status: 501 },
  )
}
