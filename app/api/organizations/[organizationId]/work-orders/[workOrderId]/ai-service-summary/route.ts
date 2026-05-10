import { NextResponse } from "next/server"
import { z } from "zod"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import {
  assertWorkOrderProductivityAccess,
  resolveProductivityRequest,
} from "@/lib/aiden/productivity-request-context"
import { runAiTask } from "@/lib/ai/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { loadWorkOrderDetailForOrg } from "@/lib/work-orders/detail-load"
import { buildWorkOrderServiceSummaryMessages, sanitizeServiceSummaryHints } from "@/lib/work-orders/service-summary-prompt"
import {
  WorkOrderServiceSummaryAiSchema,
  formatWorkOrderServiceSummaryDraft,
} from "@/lib/work-orders/service-summary-ai-schema"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  audience: z.enum(["internal", "customer_safe"]),
  contextHints: z
    .object({
      reliability: z.string().max(240).optional(),
      warranty: z.string().max(240).optional(),
      replacement: z.string().max(240).optional(),
    })
    .optional(),
})

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; workOrderId: string }> },
) {
  const { organizationId, workOrderId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(workOrderId)) {
    return jsonError("invalid_id", "Invalid organization or work order id.", 400)
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", "Send audience (internal | customer_safe) and optional contextHints.", 400)
  }

  const resolved = await resolveProductivityRequest(organizationId)
  if (!resolved.ok) {
    return resolved.response
  }
  const { ctx } = resolved

  const woAccess = await assertWorkOrderProductivityAccess(ctx, workOrderId)
  if (!woAccess.ok) {
    return woAccess.response
  }

  const loaded = await loadWorkOrderDetailForOrg(ctx.supabase, organizationId, workOrderId)
  if (!loaded.ok || !loaded.data) {
    return jsonError("not_found", "Work order not found.", 404)
  }

  const hints = sanitizeServiceSummaryHints(parsed.data.contextHints)
  const messages = buildWorkOrderServiceSummaryMessages({
    detail: loaded.data,
    audience: parsed.data.audience,
    hints,
  })

  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  const started = Date.now()
  const result = await runAiTask({
    task: "work_order_summary",
    organizationId,
    actingUserEmail: user?.email ?? null,
    input: { system: messages.system, user: messages.user },
    schema: WorkOrderServiceSummaryAiSchema,
    skipCache: true,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate summary.", 502)
  }

  const draftText = formatWorkOrderServiceSummaryDraft(result.output)

  void recordAidenUsageEvent({
    organizationId,
    userId: ctx.userId,
    featureKey: "work_order_summary",
    planTier: ctx.planId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
    durationMs: Date.now() - started,
    metadata: {
      work_order_id: loaded.data.workOrder.id,
      audience: parsed.data.audience,
      surface: "service_summary_draft",
    },
  })

  return NextResponse.json({
    ok: true,
    audience: parsed.data.audience,
    draftText,
    highlights: result.output.highlights ?? [],
  })
}
