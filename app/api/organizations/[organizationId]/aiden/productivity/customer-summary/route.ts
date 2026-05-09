import { NextResponse } from "next/server"
import { z } from "zod"
import { buildCustomerSummaryPrompt } from "@/lib/aiden/productivity-prompts"
import {
  AidenCustomerSummaryAnswerSchema,
  type AidenCustomerSummaryAnswer,
} from "@/lib/aiden/productivity-schemas"
import { loadCustomerProductivitySnapshot } from "@/lib/aiden/productivity-data"
import {
  assertCustomerProductivityAccess,
  resolveProductivityRequest,
} from "@/lib/aiden/productivity-request-context"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { runAiTask } from "@/lib/ai/server"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  customerId: z.string().regex(UUID_RE),
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
    return jsonError("invalid_body", "Send customerId (UUID).", 400)
  }

  const resolved = await resolveProductivityRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }
  const { ctx } = resolved

  const access = await assertCustomerProductivityAccess(ctx, parsed.data.customerId)
  if (!access.ok) {
    return access.response
  }

  const loaded = await loadCustomerProductivitySnapshot(ctx.supabase, organizationId, parsed.data.customerId)
  if (!loaded.ok) {
    return jsonError("not_found", "Customer not found.", 404)
  }

  const snapshotJson = JSON.stringify(loaded.snapshot)
  const prompt = buildCustomerSummaryPrompt(snapshotJson)

  const started = Date.now()
  const result = await runAiTask<AidenCustomerSummaryAnswer>({
    task: "aiden_customer_summary",
    organizationId,
    input: { system: prompt.system, user: prompt.user },
    schema: AidenCustomerSummaryAnswerSchema,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate summary.", 502)
  }

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "customer_summary",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: { customer_id: parsed.data.customerId },
  })

  return NextResponse.json({ ok: true, answer: result.output })
}
