import { NextResponse } from "next/server"
import { buildGeV13ElevenLabsProviderReadinessReport } from "@/lib/growth/media/ge-v1-3-elevenlabs-provider-readiness"
import { GE_V1_3_ELEVENLABS_LIVE_QA_MARKER } from "@/lib/growth/media/ge-v1-3-types"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  try {
    const report = await buildGeV13ElevenLabsProviderReadinessReport(access.admin)
    return NextResponse.json({
      ok: true,
      report,
      qa_marker: GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
    })
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
