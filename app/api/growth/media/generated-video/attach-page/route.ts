import { NextResponse } from "next/server"
import { geV13AttachGeneratedVideoSchema } from "@/lib/growth/media/ge-v1-3-attach-api-schema"
import { attachGeneratedMediaAssetToVideoPage } from "@/lib/growth/media/ge-v1-3-generated-video-page-attach"
import { GE_V1_3_ELEVENLABS_LIVE_QA_MARKER } from "@/lib/growth/media/ge-v1-3-types"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = geV13AttachGeneratedVideoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await attachGeneratedMediaAssetToVideoPage(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      videoPageId: parsed.data.video_page_id,
      mediaAssetId: parsed.data.media_asset_id,
      leadId: parsed.data.lead_id ?? null,
      mediaGenerationRunId: parsed.data.media_generation_run_id ?? null,
      title: parsed.data.title ?? null,
    })

    return NextResponse.json({
      ok: true,
      result,
      qa_marker: GE_V1_3_ELEVENLABS_LIVE_QA_MARKER,
    })
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
