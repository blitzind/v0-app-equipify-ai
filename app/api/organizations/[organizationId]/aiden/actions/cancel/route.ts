import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveSafeActionsRequest } from "@/lib/aiden/safe-actions/request-context"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  pending_action_id: z.string().uuid(),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization id.", 400)
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsedBody = BodySchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return jsonError("invalid_body", parsedBody.error.message, 400)
  }

  const resolved = await resolveSafeActionsRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }

  const { ctx } = resolved

  const { data: row } = await ctx.supabase
    .from("aiden_pending_actions")
    .select("id, proposed_by_user_id, status, action_type")
    .eq("id", parsedBody.data.pending_action_id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  const rec = row as { id: string; proposed_by_user_id: string; status: string; action_type: string } | null
  if (!rec) {
    return jsonError("not_found", "Pending action was not found.", 404)
  }

  if (rec.proposed_by_user_id !== ctx.userId) {
    return jsonError("forbidden", "Only the teammate who prepared this action may cancel it.", 403)
  }

  if (rec.status !== "pending") {
    return jsonError("invalid_state", "This action is no longer pending.", 409)
  }

  const { error: upErr } = await ctx.supabase
    .from("aiden_pending_actions")
    .update({
      status: "canceled",
      confirmed_by_user_id: ctx.userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", rec.id)
    .eq("status", "pending")

  if (upErr) {
    return jsonError("update_failed", upErr.message, 500)
  }

  await ctx.supabase.from("aiden_action_logs").insert({
    organization_id: organizationId,
    user_id: ctx.userId,
    action_type: rec.action_type,
    status: "canceled",
    request_payload: { pending_action_id: rec.id, canceled: true },
    result_payload: {},
  })

  return NextResponse.json({ ok: true, canceled: true })
}
