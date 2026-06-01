import { NextResponse } from "next/server"
import { z } from "zod"
import { fetchUnifiedOperatorAssistSnapshot } from "@/lib/growth/operator-assist/operator-assist-service"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { generateAiCopilotSuggestionsForCall } from "@/lib/voice/ai-copilot/ai-copilot-service"
import { resolveVoiceCallForCopilot } from "@/lib/voice/ai-copilot/resolve-voice-call-for-copilot"
import { VOICE_AI_COPILOT_QA_MARKER } from "@/lib/voice/ai-copilot/types"
import { fetchVoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/media-session-service"
import { fetchVoiceCallConversationIntelligenceSnapshot } from "@/lib/voice/intelligence/intelligence-service"
import { fetchVoiceCallControlSnapshot } from "@/lib/voice/transfer-control/call-control-service"
import { fetchRelationshipMemoryWorkspaceSnapshot } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { fetchRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/revenue-intelligence-service"
import { fetchRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/retention-intelligence-service"

export const runtime = "nodejs"

const GenerateBodySchema = z.object({
  workspaceSessionId: z.string().uuid().optional(),
})

export async function POST(request: Request, context: { params: Promise<{ callId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { callId } = await context.params
  if (!UUID_RE.test(callId)) return voiceInvalidIdResponse("callId")

  const parsedBody = GenerateBodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid generate request body." }, { status: 400 })
  }

  try {
    const resolved = await resolveVoiceCallForCopilot(ctx.admin, {
      organizationId: ctx.organizationId,
      callId,
      workspaceSessionId: parsedBody.data.workspaceSessionId ?? null,
    })
    if (!resolved) {
      return NextResponse.json({ error: "not_found", message: "Voice call not found." }, { status: 404 })
    }

    const voiceCallId = resolved.voiceCallId

    const { data: callRow } = await ctx.admin
      .schema("voice")
      .from("voice_calls")
      .select("status, to_number, from_number, lead_id")
      .eq("id", voiceCallId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle()

    if (!callRow) {
      return NextResponse.json({ error: "not_found", message: "Voice call not found." }, { status: 404 })
    }

    const liveTranscript = await fetchVoiceCallTranscriptSnapshot(ctx.admin, ctx.organizationId, voiceCallId)
    const conversationIntelligence = await fetchVoiceCallConversationIntelligenceSnapshot(
      ctx.admin,
      ctx.organizationId,
      voiceCallId,
    )
    const controlSnapshot = await fetchVoiceCallControlSnapshot(ctx.admin, ctx.organizationId, voiceCallId)
    const operatorAssist = await fetchUnifiedOperatorAssistSnapshot(ctx.admin, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      workspaceSessionId: resolved.nativeSessionId,
      voiceCallId,
      voiceTranscript: liveTranscript,
      conversationIntelligence,
      participants: controlSnapshot.participants,
    })

    const sessionPhone = (callRow.to_number as string | null) ?? (callRow.from_number as string | null)
    const relationshipMemory = sessionPhone
      ? await fetchRelationshipMemoryWorkspaceSnapshot(ctx.admin, {
          organizationId: ctx.organizationId,
          phoneNumber: sessionPhone,
          leadId: (callRow.lead_id as string | null) ?? null,
          activeVoiceCallId: voiceCallId,
        })
      : null

    const revenueIntelligence = sessionPhone
      ? await fetchRevenueIntelligenceWorkspaceSnapshot(ctx.admin, {
          organizationId: ctx.organizationId,
          phoneNumber: sessionPhone,
          leadId: (callRow.lead_id as string | null) ?? null,
          activeVoiceCallId: voiceCallId,
          relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
        })
      : null

    const retentionIntelligence = sessionPhone
      ? await fetchRetentionIntelligenceWorkspaceSnapshot(ctx.admin, {
          organizationId: ctx.organizationId,
          phoneNumber: sessionPhone,
          leadId: (callRow.lead_id as string | null) ?? null,
          activeVoiceCallId: voiceCallId,
          relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
        })
      : null

    const snapshot = await generateAiCopilotSuggestionsForCall(ctx.admin, {
      organizationId: ctx.organizationId,
      voiceCallId,
      callState: (callRow.status as string) ?? "active",
      contactLabel: relationshipMemory?.profile?.primaryContactName ?? null,
      operatorAssist,
      retentionIntelligence,
      revenueIntelligence,
      liveTranscript,
      relationshipMemoryProfileId: relationshipMemory?.profile?.id ?? null,
      relatedCustomerId: relationshipMemory?.profile?.relatedCustomerId ?? null,
      relatedProspectId: relationshipMemory?.profile?.relatedProspectId ?? null,
      relatedOpportunityId: null,
      relationshipSummary: relationshipMemory?.profile?.primaryContactName ?? null,
      operatorUserId: ctx.userId,
    })

    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_AI_COPILOT_QA_MARKER,
      voiceCallId,
      resolvedFrom: resolved.resolvedFrom,
      snapshot,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "generate_failed", message }, { status: 500 })
  }
}
