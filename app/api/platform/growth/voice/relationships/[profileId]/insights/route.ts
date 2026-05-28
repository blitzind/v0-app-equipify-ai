import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchRelationshipInsightsSnapshot } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { profileId } = await context.params
  if (!UUID_RE.test(profileId)) return voiceInvalidIdResponse("profileId").response

  try {
    const insights = await fetchRelationshipInsightsSnapshot(ctx.admin, ctx.organizationId, profileId)
    if (!insights) {
      return NextResponse.json({ error: "not_found", message: "Relationship profile not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, ...insights })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
