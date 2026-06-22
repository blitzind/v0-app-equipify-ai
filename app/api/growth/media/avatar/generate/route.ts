import { NextResponse } from "next/server"
import { growthAiAvatarGenerateSchema } from "@/lib/growth/media/growth-ai-avatar-generation-api-schema"
import { createGrowthAiAvatarGenerationJob } from "@/lib/growth/media/growth-ai-avatar-generation-service"
import { GROWTH_AI_AVATAR_GENERATION_QA_MARKER } from "@/lib/growth/media/growth-ai-avatar-generation-types"
import { mapGeV13ProspectFromApiBody } from "@/lib/growth/media/ge-v1-3-api-utils"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"
import { growthAiAvatarSafetyJson } from "@/lib/growth/media/growth-ai-avatar-generation-api-utils"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthAiAvatarGenerateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const provider = parsed.data.provider ?? "elevenlabs"
    const job = await createGrowthAiAvatarGenerationJob(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      generation: {
        videoPageId: parsed.data.video_page_id,
        scriptVersionId: parsed.data.script_version_id ?? null,
        avatarId: parsed.data.avatar_id,
        provider,
        voiceMediaAssetId: parsed.data.voice_media_asset_id ?? null,
        settings: parsed.data.settings,
        dryRun: parsed.data.dry_run,
        prospect: mapGeV13ProspectFromApiBody(parsed.data),
        attachToPageOnComplete: parsed.data.attach_to_page_on_complete ?? false,
      },
    })

    return NextResponse.json(
      growthAiAvatarSafetyJson({
        ok: true,
        job,
        provider,
        qa_marker: GROWTH_AI_AVATAR_GENERATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
