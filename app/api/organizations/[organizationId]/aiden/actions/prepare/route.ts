import { NextResponse } from "next/server"
import { z } from "zod"
import { affectedRecordIdsForProposal } from "@/lib/aiden/safe-actions/affected-ids"
import { buildSafeActionPreparePrompt } from "@/lib/aiden/safe-actions/prepare-prompt"
import { resolveSafeActionsRequest } from "@/lib/aiden/safe-actions/request-context"
import { SafeActionPrepareAnswerSchema } from "@/lib/aiden/safe-actions/schema"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { runAiTask } from "@/lib/ai/server"

export const runtime = "nodejs"
export const maxDuration = 75

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PENDING_TTL_MS = 30 * 60 * 1000

const BodySchema = z.object({
  intent: z.string().min(1).max(6000),
  currentPath: z.string().max(2048).optional(),
  currentModule: z.string().max(120).optional(),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

function payloadSummary(payload: unknown): string {
  try {
    const s = JSON.stringify(payload)
    return s.length > 800 ? `${s.slice(0, 800)}…` : s
  } catch {
    return ""
  }
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
  const prompt = buildSafeActionPreparePrompt({
    intent: parsedBody.data.intent,
    moduleLabel: parsedBody.data.currentModule?.trim() || "General",
    path: parsedBody.data.currentPath?.trim() || "/",
  })

  const started = Date.now()
  const aiResult = await runAiTask({
    task: "aiden_safe_action_prepare",
    organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: SafeActionPrepareAnswerSchema,
  })

  if (!aiResult.ok) {
    return jsonError("ai_failed", aiResult.error.message || "Could not prepare an action.", 502)
  }

  const proposal = aiResult.output
  const affectedIds = affectedRecordIdsForProposal(proposal)
  const expiresAt = new Date(Date.now() + PENDING_TTL_MS).toISOString()

  const { data: pendingRow, error: insErr } = await ctx.supabase
    .from("aiden_pending_actions")
    .insert({
      organization_id: organizationId,
      proposed_by_user_id: ctx.userId,
      action_type: proposal.action_type,
      title: proposal.title,
      explanation: proposal.explanation,
      affected_record_ids: affectedIds,
      proposed_payload: proposal.proposed_payload as Record<string, unknown>,
      risk_level: proposal.risk_level,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id, expires_at, action_type, title, explanation, affected_record_ids, proposed_payload, risk_level, status")
    .single()

  if (insErr || !pendingRow) {
    return jsonError("persist_failed", insErr?.message ?? "Could not save pending action.", 500)
  }

  await ctx.supabase.from("aiden_action_logs").insert({
    organization_id: organizationId,
    user_id: ctx.userId,
    action_type: proposal.action_type,
    status: "proposed",
    request_payload: {
      pending_action_id: pendingRow.id,
      title: proposal.title,
      payload_summary: payloadSummary(proposal.proposed_payload),
    },
    result_payload: {},
  })

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "action_prepare",
    planTier: ctx.planId,
    promptTokens: aiResult.usage.promptTokens,
    completionTokens: aiResult.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: { action_type: proposal.action_type },
  })

  return NextResponse.json({
    ok: true,
    pending: pendingRow,
    confirmation_required: true,
  })
}
