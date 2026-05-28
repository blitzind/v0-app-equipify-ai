import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  fetchAiOutboundWorkspaceSnapshot,
  queueOutboundAiSession,
} from "@/lib/voice/ai-outbound/ai-outbound-service"
import type { VoiceAiOutboundWorkflowType } from "@/lib/voice/ai-outbound/types"
import { VOICE_AI_OUTBOUND_WORKFLOW_TYPES } from "@/lib/voice/ai-outbound/types"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const snapshot = await fetchAiOutboundWorkspaceSnapshot(ctx.admin, ctx.organizationId)
    return NextResponse.json({ ok: true, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      phoneNumber?: string
      outboundWorkflowType?: VoiceAiOutboundWorkflowType
      relatedCustomerId?: string | null
      relatedProspectId?: string | null
      relationshipMemoryProfileId?: string | null
      sourceRecoveryEventId?: string | null
      sourceCampaignId?: string | null
      messagePreview?: string | null
    }

    if (!body.phoneNumber?.trim()) {
      return NextResponse.json({ error: "invalid_input", message: "phoneNumber is required." }, { status: 400 })
    }

    const workflowType = body.outboundWorkflowType ?? "operator_assisted_callback"
    if (!VOICE_AI_OUTBOUND_WORKFLOW_TYPES.includes(workflowType)) {
      return NextResponse.json({ error: "invalid_input", message: "Invalid workflow type." }, { status: 400 })
    }

    const session = await queueOutboundAiSession(ctx.admin, {
      organizationId: ctx.organizationId,
      phoneNumber: body.phoneNumber.trim(),
      outboundWorkflowType: workflowType,
      relatedCustomerId: body.relatedCustomerId,
      relatedProspectId: body.relatedProspectId,
      relationshipMemoryProfileId: body.relationshipMemoryProfileId,
      sourceRecoveryEventId: body.sourceRecoveryEventId,
      sourceCampaignId: body.sourceCampaignId,
      messagePreview: body.messagePreview,
      createdBy: ctx.userId,
    })

    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "queue_failed", message }, { status: 500 })
  }
}
