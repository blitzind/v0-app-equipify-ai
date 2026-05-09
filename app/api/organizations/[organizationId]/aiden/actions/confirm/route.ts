import { NextResponse } from "next/server"
import { z } from "zod"
import { executeSafeAction } from "@/lib/aiden/safe-actions/execute"
import { resolveSafeActionsRequest } from "@/lib/aiden/safe-actions/request-context"
import { parsePendingSafeAction } from "@/lib/aiden/safe-actions/schema"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"

export const runtime = "nodejs"
export const maxDuration = 60

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
  const started = Date.now()

  const { data: row, error: loadErr } = await ctx.supabase
    .from("aiden_pending_actions")
    .select(
      "id, proposed_by_user_id, status, expires_at, action_type, title, explanation, proposed_payload, risk_level, organization_id",
    )
    .eq("id", parsedBody.data.pending_action_id)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr || !row) {
    return jsonError("not_found", "Pending action was not found.", 404)
  }

  const rec = row as {
    id: string
    proposed_by_user_id: string
    status: string
    expires_at: string
    action_type: string
    title: string
    explanation: string
    proposed_payload: unknown
    risk_level: string
    organization_id: string
  }

  if (rec.proposed_by_user_id !== ctx.userId) {
    return jsonError("forbidden", "Only the teammate who prepared this action may confirm it.", 403)
  }

  if (rec.status !== "pending") {
    return jsonError("invalid_state", "This action is no longer pending.", 409)
  }

  const expiresAt = new Date(rec.expires_at).getTime()
  if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
    await ctx.supabase
      .from("aiden_pending_actions")
      .update({
        status: "expired",
        error_message: "This prepared action expired before confirmation.",
      })
      .eq("id", rec.id)
      .eq("organization_id", organizationId)
      .eq("status", "pending")

    await ctx.supabase.from("aiden_action_logs").insert({
      organization_id: organizationId,
      user_id: ctx.userId,
      action_type: rec.action_type,
      status: "canceled",
      request_payload: { pending_action_id: rec.id, reason: "expired" },
      result_payload: {},
    })

    return jsonError("expired", "This prepared action expired. Prepare it again to continue.", 410)
  }

  const proposal = parsePendingSafeAction({
    action_type: rec.action_type,
    title: rec.title,
    explanation: rec.explanation,
    proposed_payload: rec.proposed_payload,
    risk_level: rec.risk_level,
  })

  if (!proposal) {
    await ctx.supabase
      .from("aiden_pending_actions")
      .update({
        status: "failed",
        error_message: "Stored payload failed validation.",
        confirmed_by_user_id: ctx.userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", rec.id)
      .eq("status", "pending")

    await ctx.supabase.from("aiden_action_logs").insert({
      organization_id: organizationId,
      user_id: ctx.userId,
      action_type: rec.action_type,
      status: "failed",
      request_payload: { pending_action_id: rec.id },
      result_payload: { error: "invalid_stored_payload" },
    })

    return jsonError("invalid_payload", "This prepared action could not be validated.", 400)
  }

  const exec = await executeSafeAction({
    supabase: ctx.supabase,
    organizationId,
    userId: ctx.userId,
    permissions: ctx.permissions,
    parsed: proposal,
  })

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "action_confirm",
    planTier: ctx.planId,
    durationMs: Date.now() - started,
    metadata: {
      pending_action_id: rec.id,
      success: exec.ok,
      code: exec.ok ? null : exec.code,
    },
  })

  if (!exec.ok) {
    await ctx.supabase
      .from("aiden_pending_actions")
      .update({
        status: "failed",
        error_message: exec.message,
        confirmed_by_user_id: ctx.userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", rec.id)
      .eq("status", "pending")

    await ctx.supabase.from("aiden_action_logs").insert({
      organization_id: organizationId,
      user_id: ctx.userId,
      action_type: rec.action_type,
      status: "failed",
      request_payload: { pending_action_id: rec.id, confirmed: true },
      result_payload: { error: exec.code, message: exec.message },
    })

    return NextResponse.json(
      {
        ok: false,
        error: exec.code,
        message: exec.message,
        pending_action_id: rec.id,
      },
      { status: 422 },
    )
  }

  await ctx.supabase
    .from("aiden_pending_actions")
    .update({
      status: "confirmed",
      confirmed_by_user_id: ctx.userId,
      confirmed_at: new Date().toISOString(),
      result_payload: exec.result,
    })
    .eq("id", rec.id)
    .eq("status", "pending")

  await ctx.supabase.from("aiden_action_logs").insert({
    organization_id: organizationId,
    user_id: ctx.userId,
    action_type: rec.action_type,
    status: "completed",
    request_payload: { pending_action_id: rec.id, confirmed: true },
    result_payload: exec.result,
  })

  return NextResponse.json({
    ok: true,
    summary: exec.summary,
    result: exec.result,
    pending_action_id: rec.id,
  })
}
