import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import {
  fetchUnifiedCommunicationThreadDetail,
  overridePreferredChannel,
  recordUnifiedCommunicationEvent,
} from "@/lib/voice/multi-channel-intelligence/multichannel-intelligence-service"
import type {
  VoiceUnifiedCommunicationChannel,
  VoiceUnifiedCommunicationEventType,
} from "@/lib/voice/multi-channel-intelligence/types"
import {
  VOICE_UNIFIED_COMMUNICATION_CHANNELS,
  VOICE_UNIFIED_COMMUNICATION_EVENT_TYPES,
} from "@/lib/voice/multi-channel-intelligence/types"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { threadId } = await context.params
  if (!UUID_RE.test(threadId)) return voiceInvalidIdResponse("threadId")

  try {
    const detail = await fetchUnifiedCommunicationThreadDetail(ctx.admin, ctx.organizationId, threadId)
    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "Thread not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...detail })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { threadId } = await context.params
  if (!UUID_RE.test(threadId)) return voiceInvalidIdResponse("threadId")

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      eventType?: string
      channel?: string
      evidenceText?: string
      sourceSystem?: string
      sourceSessionId?: string | null
      sourceCallId?: string | null
      preferredChannel?: string
      workflowOrchestrationId?: string | null
      payload?: Record<string, unknown>
    }

    if (body.action === "override_preferred_channel") {
      if (!body.preferredChannel || !VOICE_UNIFIED_COMMUNICATION_CHANNELS.includes(body.preferredChannel as VoiceUnifiedCommunicationChannel)) {
        return NextResponse.json({ error: "invalid_channel", message: "Invalid preferred channel." }, { status: 400 })
      }
      const thread = await overridePreferredChannel(ctx.admin, {
        organizationId: ctx.organizationId,
        threadId,
        preferredChannel: body.preferredChannel as VoiceUnifiedCommunicationChannel,
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, thread })
    }

    if (!body.eventType || !VOICE_UNIFIED_COMMUNICATION_EVENT_TYPES.includes(body.eventType as VoiceUnifiedCommunicationEventType)) {
      return NextResponse.json({ error: "invalid_event", message: "Invalid event type." }, { status: 400 })
    }

    if (!body.channel || !VOICE_UNIFIED_COMMUNICATION_CHANNELS.includes(body.channel as VoiceUnifiedCommunicationChannel)) {
      return NextResponse.json({ error: "invalid_channel", message: "Invalid channel." }, { status: 400 })
    }

    const event = await recordUnifiedCommunicationEvent(ctx.admin, {
      organizationId: ctx.organizationId,
      threadId,
      eventType: body.eventType as VoiceUnifiedCommunicationEventType,
      channel: body.channel as VoiceUnifiedCommunicationChannel,
      evidenceText: body.evidenceText ?? "",
      sourceSystem: body.sourceSystem,
      sourceSessionId: body.sourceSessionId,
      sourceCallId: body.sourceCallId,
      userId: ctx.userId,
      payload: body.payload,
      workflowOrchestrationId: body.workflowOrchestrationId,
    })

    return NextResponse.json({ ok: true, event })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
