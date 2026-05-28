import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { getRelationshipMemoryProfile } from "@/lib/voice/repository/voice-relationship-memory-repository"
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
    const profile = await getRelationshipMemoryProfile(ctx.admin, ctx.organizationId, profileId)
    if (!profile) {
      return NextResponse.json({ error: "not_found", message: "Relationship profile not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER, profile })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
