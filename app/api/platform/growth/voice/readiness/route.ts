import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildVoiceProductionReadinessCenter } from "@/lib/voice/production-readiness/build-voice-production-readiness-center"
import { VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER } from "@/lib/voice/production-readiness/types"
import { resolveVoiceInfrastructureOrganizationId } from "@/lib/voice/repository/voice-repository"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = resolveVoiceInfrastructureOrganizationId()
  const origin = new URL(request.url).origin

  try {
    const center = await buildVoiceProductionReadinessCenter(access.admin, organizationId, origin)
    return NextResponse.json({
      ok: true,
      qaMarker: VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
      center,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
        message,
        qaMarker: VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
      },
      { status: 500 },
    )
  }
}
