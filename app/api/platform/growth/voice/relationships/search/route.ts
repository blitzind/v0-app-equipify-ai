import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { searchRelationshipMemoryProfiles } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const url = new URL(request.url)
  const query = url.searchParams.get("q") ?? undefined

  try {
    const profiles = await searchRelationshipMemoryProfiles(ctx.admin, ctx.organizationId, query)
    return NextResponse.json({ ok: true, qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER, profiles })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "search_failed", message }, { status: 500 })
  }
}
