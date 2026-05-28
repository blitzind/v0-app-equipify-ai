import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createUnifiedCommunicationThreadRecord,
  fetchMultichannelIntelligenceWorkspace,
} from "@/lib/voice/multi-channel-intelligence/multichannel-intelligence-service"
import type { VoiceUnifiedCommunicationThreadType } from "@/lib/voice/multi-channel-intelligence/types"
import { VOICE_UNIFIED_COMMUNICATION_THREAD_TYPES } from "@/lib/voice/multi-channel-intelligence/types"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const workspace = await fetchMultichannelIntelligenceWorkspace(ctx.admin, ctx.organizationId)
    return NextResponse.json({
      ok: true,
      threads: workspace.activeThreads,
      recentEvents: workspace.recentEvents,
    })
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
      threadType?: string
      primaryChannel?: string
      relationshipMemoryProfileId?: string | null
      relatedCustomerId?: string | null
      relatedProspectId?: string | null
      relatedOpportunityId?: string | null
      communicationSummary?: string
      metadata?: Record<string, unknown>
    }

    if (!body.threadType || !VOICE_UNIFIED_COMMUNICATION_THREAD_TYPES.includes(body.threadType as VoiceUnifiedCommunicationThreadType)) {
      return NextResponse.json({ error: "invalid_type", message: "Invalid thread type." }, { status: 400 })
    }

    const thread = await createUnifiedCommunicationThreadRecord(ctx.admin, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      threadType: body.threadType as VoiceUnifiedCommunicationThreadType,
      primaryChannel: body.primaryChannel as never,
      relationshipMemoryProfileId: body.relationshipMemoryProfileId,
      relatedCustomerId: body.relatedCustomerId,
      relatedProspectId: body.relatedProspectId,
      relatedOpportunityId: body.relatedOpportunityId,
      communicationSummary: body.communicationSummary,
      metadata: body.metadata,
    })

    return NextResponse.json({ ok: true, thread })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
