import { NextResponse } from "next/server"
import { listActionAuditLogForOrg } from "@/lib/aiden/actions/action-audit-log"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string; actionId: string }> },
) {
  const { organizationId, actionId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(actionId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const url = new URL(request.url)
  const limitRaw = url.searchParams.get("limit")
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 80

  const { data, error } = await listActionAuditLogForOrg(gate.supabase, organizationId, {
    preparedActionId: actionId,
    limit: Number.isFinite(limit) ? limit : 80,
  })
  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    items: data.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actionId: row.action_id,
      actorUserId: row.actor_user_id,
      details: row.details,
      createdAt: row.created_at,
    })),
  })
}
