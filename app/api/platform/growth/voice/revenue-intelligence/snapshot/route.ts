import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchRevenueIntelligenceWorkspaceSnapshot } from "@/lib/voice/revenue-intelligence/revenue-intelligence-service"
import { VOICE_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/voice/revenue-intelligence/types"

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
    const snapshot = await fetchRevenueIntelligenceWorkspaceSnapshot(ctx.admin, {
      organizationId: ctx.organizationId,
      phoneNumber,
      leadId,
      activeVoiceCallId: voiceCallId,
      relationshipMemoryProfileId: profileId,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_REVENUE_INTELLIGENCE_QA_MARKER, snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
