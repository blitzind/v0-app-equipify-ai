import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { fetchRelationshipTimelineSnapshot } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { profileId } = await context.params
  if (!UUID_RE.test(profileId)) return voiceInvalidIdResponse("profileId").response

  const url = new URL(request.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 24), 50)

  try {
    const snapshot = await fetchRelationshipTimelineSnapshot(ctx.admin, ctx.organizationId, profileId, limit)
    if (!snapshot) {
      return NextResponse.json({ error: "not_found", message: "Relationship profile not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER, ...snapshot })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
