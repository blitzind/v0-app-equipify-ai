import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import {
  applyWorkflowOrchestrationAction,
  fetchWorkflowOrchestrationDetail,
} from "@/lib/voice/workflow-orchestration/workflow-orchestration-service"
import type { WorkflowOrchestrationAction } from "@/lib/voice/workflow-orchestration/types"

export const runtime = "nodejs"

const VALID_ACTIONS: WorkflowOrchestrationAction[] = [
  "assign_operator",
  "escalate",
  "resolve",
  "cancel",
  "compliance_hold",
  "operator_override",
  "recommend_followup",
]

export async function GET(_request: Request, context: { params: Promise<{ orchestrationId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { orchestrationId } = await context.params
  if (!UUID_RE.test(orchestrationId)) return voiceInvalidIdResponse("orchestrationId")

  try {
    const detail = await fetchWorkflowOrchestrationDetail(ctx.admin, ctx.organizationId, orchestrationId)
    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "Orchestration not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...detail })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ orchestrationId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { orchestrationId } = await context.params
  if (!UUID_RE.test(orchestrationId)) return voiceInvalidIdResponse("orchestrationId")

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      operatorId?: string | null
      blockedReason?: string | null
      complianceState?: string | null
    }

    if (!body.action || !VALID_ACTIONS.includes(body.action as WorkflowOrchestrationAction)) {
      return NextResponse.json({ error: "invalid_action", message: "Unknown action." }, { status: 400 })
    }

    const orchestration = await applyWorkflowOrchestrationAction(ctx.admin, {
      organizationId: ctx.organizationId,
      orchestrationId,
      action: body.action as WorkflowOrchestrationAction,
      userId: ctx.userId,
      operatorId: body.operatorId,
      blockedReason: body.blockedReason,
      complianceState: body.complianceState,
    })

    return NextResponse.json({ ok: true, orchestration })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
