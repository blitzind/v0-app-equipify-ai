import { NextResponse } from "next/server"
import { growthAiAvatarJobActionSchema } from "@/lib/growth/media/growth-ai-avatar-generation-api-schema"
import { cancelGrowthAiAvatarGenerationJob } from "@/lib/growth/media/growth-ai-avatar-generation-service"
import { GROWTH_AI_AVATAR_GENERATION_QA_MARKER } from "@/lib/growth/media/growth-ai-avatar-generation-types"
import { growthAiAvatarSafetyJson } from "@/lib/growth/media/growth-ai-avatar-generation-api-utils"
import {
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthAiAvatarJobActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const job = await cancelGrowthAiAvatarGenerationJob(access.admin, {
      organizationId: access.organizationId,
      runId: id,
      reason: parsed.data.reason ?? "Operator cancelled",
    })

    return NextResponse.json(
      growthAiAvatarSafetyJson({
        ok: true,
        job,
        provider: job.provider,
        qa_marker: GROWTH_AI_AVATAR_GENERATION_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
