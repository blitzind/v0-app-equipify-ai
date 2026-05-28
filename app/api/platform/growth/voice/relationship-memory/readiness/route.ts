import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchRelationshipMemoryReadiness } from "@/lib/voice/relationship-memory/relationship-memory-service"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const readiness = await fetchRelationshipMemoryReadiness(ctx.admin, ctx.organizationId)
    return NextResponse.json({ ok: true, readiness })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
