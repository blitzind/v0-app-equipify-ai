import { NextResponse } from "next/server"
import { z } from "zod"
import { buildDraftPrompt } from "@/lib/aiden/productivity-prompts"
import {
  AidenDraftGenerationAnswerSchema,
  DraftKindSchema,
  type AidenDraftGenerationAnswer,
} from "@/lib/aiden/productivity-schemas"
import { loadDraftSnapshot } from "@/lib/aiden/productivity-data"
import {
  assertCustomerProductivityAccess,
  assertWorkOrderProductivityAccess,
  resolveProductivityRequest,
} from "@/lib/aiden/productivity-request-context"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { runAiTask } from "@/lib/ai/server"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z
  .object({
    draftKind: DraftKindSchema,
    customerId: z.string().regex(UUID_RE).optional().nullable(),
    workOrderId: z.string().min(1).max(120).optional().nullable(),
    extraContext: z.string().max(4000).optional().nullable(),
  })
  .refine((b) => Boolean(b.customerId?.trim()) || Boolean(b.workOrderId?.trim()), {
    message: "Provide customerId and/or workOrderId.",
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

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", parsed.error.message, 400)
  }

  const resolved = await resolveProductivityRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }
  const { ctx } = resolved

  const customerId = parsed.data.customerId?.trim() || null
  const workOrderId = parsed.data.workOrderId?.trim() || null

  if (customerId) {
    const a = await assertCustomerProductivityAccess(ctx, customerId)
    if (!a.ok) return a.response
  }
  if (workOrderId) {
    const a = await assertWorkOrderProductivityAccess(ctx, workOrderId)
    if (!a.ok) return a.response
  }

  const loaded = await loadDraftSnapshot({
    supabase: ctx.supabase,
    organizationId,
    workOrderId,
    customerId,
  })

  if (!loaded.ok) {
    return jsonError("not_found", "Record not found.", 404)
  }

  const snapshotJson = JSON.stringify(loaded.snapshot)
  const prompt = buildDraftPrompt({
    draftKind: parsed.data.draftKind,
    snapshotJson,
    extraContext: parsed.data.extraContext,
  })

  const started = Date.now()
  const result = await runAiTask<AidenDraftGenerationAnswer>({
    task: "aiden_draft_generation",
    organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: AidenDraftGenerationAnswerSchema,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate draft.", 502)
  }

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "draft_generation",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: {
      draft_kind: parsed.data.draftKind,
      snapshot: loaded.label,
    },
  })

  return NextResponse.json({ ok: true, answer: result.output })
}
