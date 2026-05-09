import { NextResponse } from "next/server"
import { z } from "zod"
import { buildWorkOrderProductivityPrompt } from "@/lib/aiden/productivity-prompts"
import {
  AidenWorkOrderProductivityAnswerSchema,
  type AidenWorkOrderProductivityAnswer,
} from "@/lib/aiden/productivity-schemas"
import { workOrderDetailToProductivitySnapshot } from "@/lib/aiden/productivity-data"
import {
  assertWorkOrderProductivityAccess,
  resolveProductivityRequest,
} from "@/lib/aiden/productivity-request-context"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { loadWorkOrderDetailForOrg } from "@/lib/work-orders/detail-load"
import { runAiTask } from "@/lib/ai/server"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  workOrderId: z.string().min(1).max(120),
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
    return jsonError("invalid_body", "Send workOrderId.", 400)
  }

  const resolved = await resolveProductivityRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }
  const { ctx } = resolved

  const trimmedWoId = parsed.data.workOrderId.trim()
  const woAccess = await assertWorkOrderProductivityAccess(ctx, trimmedWoId)
  if (!woAccess.ok) {
    return woAccess.response
  }

  const loaded = await loadWorkOrderDetailForOrg(ctx.supabase, organizationId, trimmedWoId)
  if (!loaded.ok || !loaded.data) {
    return jsonError("not_found", "Work order not found.", 404)
  }

  const snapshotJson = JSON.stringify(workOrderDetailToProductivitySnapshot(loaded.data))
  const prompt = buildWorkOrderProductivityPrompt(snapshotJson)

  const started = Date.now()
  const result = await runAiTask<AidenWorkOrderProductivityAnswer>({
    task: "aiden_work_order_productivity",
    organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: AidenWorkOrderProductivityAnswerSchema,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate summary.", 502)
  }

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "work_order_summary",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: { work_order_id: loaded.data.workOrder.id },
  })

  return NextResponse.json({ ok: true, answer: result.output })
}
