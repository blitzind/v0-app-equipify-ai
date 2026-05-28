import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchRetentionIntelligenceWorkspaceSnapshot } from "@/lib/voice/retention-intelligence/retention-intelligence-service"
import { VOICE_RETENTION_INTELLIGENCE_QA_MARKER } from "@/lib/voice/retention-intelligence/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const url = new URL(request.url)
  const phoneNumber = url.searchParams.get("phoneNumber")
  const leadId = url.searchParams.get("leadId")
  const profileId = url.searchParams.get("profileId")
  const voiceCallId = url.searchParams.get("voiceCallId")

  try {
    const snapshot = await fetchRetentionIntelligenceWorkspaceSnapshot(ctx.admin, {
      organizationId: ctx.organizationId,
      phoneNumber,
      leadId,
      activeVoiceCallId: voiceCallId,
      relationshipMemoryProfileId: profileId,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_RETENTION_INTELLIGENCE_QA_MARKER, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
