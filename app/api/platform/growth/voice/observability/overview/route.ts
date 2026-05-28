import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceObservabilityOverview, fetchVoiceObservabilityReadiness } from "@/lib/voice/observability/observability-service"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const [overview, readiness] = await Promise.all([
      fetchVoiceObservabilityOverview(ctx.admin, ctx.organizationId),
      fetchVoiceObservabilityReadiness(ctx.admin, ctx.organizationId),
    ])
    return NextResponse.json({ ok: true, overview, readiness })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
