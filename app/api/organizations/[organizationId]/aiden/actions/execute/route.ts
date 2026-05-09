import { NextResponse } from "next/server"
import { z } from "zod"
import { getAidenActionDefinition } from "@/lib/aiden/actions/registry"
import { AidenProposedActionSchema } from "@/lib/aiden/actions/types"
import {
  canExecuteAidenAction,
  getAidenActionAvailability,
  getAidenActionMembership,
} from "@/lib/permissions/aiden-actions"
import { isAssignedWorkOnly } from "@/lib/permissions/technician-scope"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  proposedAction: AidenProposedActionSchema,
  confirmed: z.boolean(),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

async function logAction(args: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
  organizationId: string
  userId: string
  actionType: string
  status: "confirmed" | "completed" | "failed"
  requestPayload: unknown
  resultPayload: unknown
}) {
  await args.supabase.from("aiden_action_logs").insert({
    organization_id: args.organizationId,
    user_id: args.userId,
    action_type: args.actionType,
    status: args.status,
    request_payload: args.requestPayload,
    result_payload: args.resultPayload,
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization id.", 400)
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", "A confirmed proposed action is required.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user?.id) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const membership = await getAidenActionMembership({ supabase, organizationId, userId: user.id })
  if (!membership) {
    return jsonError("forbidden", "You do not have access to this organization.", 403)
  }

  const availability = await getAidenActionAvailability({ supabase, organizationId })
  const action = parsed.data.proposedAction
  const permission = canExecuteAidenAction({
    actionType: action.type,
    permissions: membership.permissions,
    availability,
  })
  if (!permission.ok) {
    return jsonError("aiden_actions_denied", permission.message, 403)
  }
  if (isAssignedWorkOnly(membership.permissions)) {
    return jsonError(
      "aiden_actions_denied",
      "AIden workflow actions that create, assign, schedule, or manage financial records are restricted for technician access.",
      403,
    )
  }

  const definition = getAidenActionDefinition(action.type)
  if (!definition) {
    return jsonError("unsupported_action", "This AIden action is not supported.", 400)
  }

  if (!parsed.data.confirmed) {
    await logAction({
      supabase,
      organizationId,
      userId: user.id,
      actionType: action.type,
      status: "canceled",
      requestPayload: action,
      resultPayload: {},
    })
    return NextResponse.json({ ok: true, canceled: true })
  }

  await logAction({
    supabase,
    organizationId,
    userId: user.id,
    actionType: action.type,
    status: "confirmed",
    requestPayload: action,
    resultPayload: {},
  })

  const payload = definition.schema.safeParse(action.previewData)
  if (!payload.success) {
    return jsonError("invalid_action_payload", "The action preview is missing required details.", 400)
  }

  try {
    const result = await definition.execute(
      { supabase, organizationId, userId: user.id, permissions: membership.permissions },
      payload.data,
    )
    await logAction({
      supabase,
      organizationId,
      userId: user.id,
      actionType: action.type,
      status: "completed",
      requestPayload: action,
      resultPayload: result,
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "AIden action failed."
    await logAction({
      supabase,
      organizationId,
      userId: user.id,
      actionType: action.type,
      status: "failed",
      requestPayload: action,
      resultPayload: { message },
    })
    return jsonError("action_failed", message, 500)
  }
}
