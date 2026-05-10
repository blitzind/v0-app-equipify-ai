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
import { sanitizeServiceSummaryHints } from "@/lib/work-orders/service-summary-prompt"
import { buildWorkOrderTechnicianAssistMessages } from "@/lib/work-orders/technician-assist-prompt"
import { WorkOrderTechnicianAssistAiSchema, type WorkOrderTechnicianAssistAi } from "@/lib/work-orders/technician-assist-schema"

export const runtime = "nodejs"
export const maxDuration = 60

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
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

  const rawBody = await request.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return jsonError("invalid_body", "Optional contextHints only.", 400)
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
  const messages = buildWorkOrderTechnicianAssistMessages({
    detail: loaded.data,
    hints,
  })

  const authClient = await createServerSupabaseClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  const started = Date.now()
  const result = await runAiTask<WorkOrderTechnicianAssistAi>({
    task: "work_order_technician_assist",
    organizationId,
    actingUserEmail: user?.email ?? null,
    input: { system: messages.system, user: messages.user },
    schema: WorkOrderTechnicianAssistAiSchema,
    skipCache: true,
  })

  if (!result.ok) {
    return jsonError("ai_failed", result.error.message || "Could not generate guidance.", 502)
  }

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
      surface: "technician_guidance_draft",
      ai_task: "work_order_technician_assist",
    },
  })

  return NextResponse.json({
    ok: true,
    guidance: result.output,
  })
}
