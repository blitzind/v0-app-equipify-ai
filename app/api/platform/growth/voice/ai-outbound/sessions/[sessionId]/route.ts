import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import {
  applyOutboundApprovalAction,
  initiateOutboundAiSession,
  operatorTakeoverOutboundSession,
  processOutboundAiTurn,
} from "@/lib/voice/ai-outbound/ai-outbound-service"
import type { OutboundApprovalAction } from "@/lib/voice/ai-outbound/types"
import { getOutboundSession, listOutboundEvents } from "@/lib/voice/repository/voice-ai-outbound-repository"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { sessionId } = await context.params
  if (!UUID_RE.test(sessionId)) return voiceInvalidIdResponse("sessionId")

  try {
    const session = await getOutboundSession(ctx.admin, ctx.organizationId, sessionId)
    if (!session) {
      return NextResponse.json({ error: "not_found", message: "Session not found." }, { status: 404 })
    }
    const events = await listOutboundEvents(ctx.admin, ctx.organizationId, sessionId, 30)
    return NextResponse.json({ ok: true, session, events })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { sessionId } = await context.params
  if (!UUID_RE.test(sessionId)) return voiceInvalidIdResponse("sessionId")

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      scheduledAt?: string | null
      voiceCallId?: string | null
      calleeText?: string
      transcriptSegmentId?: string | null
      organizationName?: string | null
    }

    if (body.action === "approve" || body.action === "reject" || body.action === "cancel" || body.action === "schedule") {
      const session = await applyOutboundApprovalAction(ctx.admin, {
        organizationId: ctx.organizationId,
        sessionId,
        action: body.action as OutboundApprovalAction,
        userId: ctx.userId,
        scheduledAt: body.scheduledAt,
      })
      return NextResponse.json({ ok: true, session })
    }

    if (body.action === "initiate") {
      const session = await initiateOutboundAiSession(ctx.admin, {
        organizationId: ctx.organizationId,
        sessionId,
        voiceCallId: body.voiceCallId,
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, session })
    }

    if (body.action === "takeover") {
      const session = await operatorTakeoverOutboundSession(ctx.admin, {
        organizationId: ctx.organizationId,
        sessionId,
        operatorId: ctx.userId,
      })
      return NextResponse.json({ ok: true, session })
    }

    if (body.action === "turn") {
      const result = await processOutboundAiTurn(ctx.admin, {
        organizationId: ctx.organizationId,
        sessionId,
        calleeText: body.calleeText ?? "",
        transcriptSegmentId: body.transcriptSegmentId,
        organizationName: body.organizationName,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    return NextResponse.json({ error: "invalid_action", message: "Unknown action." }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
