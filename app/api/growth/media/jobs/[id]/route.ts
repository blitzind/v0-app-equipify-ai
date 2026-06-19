import { NextResponse } from "next/server"
import { growthMediaGenerationJobPatchSchema } from "@/lib/growth/media/growth-media-generation-api-schema"
import {
  cancelMediaGenerationJob,
  getMediaGenerationJobById,
  patchMediaGenerationJob,
} from "@/lib/growth/media/growth-media-generation-job-service"
import {
  growthMediaGenerationSafetyJson,
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"
import {
  GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
  type GrowthMediaGenerationStatus,
} from "@/lib/growth/media/growth-media-generation-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  try {
    const job = await getMediaGenerationJobById(access.admin, {
      organizationId: access.organizationId,
      runId: id,
    })
    if (!job) return mapGrowthMediaGenerationApiError(new Error("not_found"))

    return NextResponse.json(
      growthMediaGenerationSafetyJson({
        ok: true,
        job,
        qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const parsed = growthMediaGenerationJobPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    if (parsed.data.cancel) {
      const job = await cancelMediaGenerationJob(access.admin, {
        organizationId: access.organizationId,
        runId: id,
        reason: parsed.data.cancel_reason ?? null,
      })
      return NextResponse.json(
        growthMediaGenerationSafetyJson({
          ok: true,
          job,
          qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
        }),
      )
    }

    const job = await patchMediaGenerationJob(access.admin, {
      organizationId: access.organizationId,
      runId: id,
      status: parsed.data.status as GrowthMediaGenerationStatus | undefined,
      progressPercent: parsed.data.progress_percent,
      error: parsed.data.error,
      retry: parsed.data.retry,
      retryReason: parsed.data.retry_reason ?? null,
    })

    return NextResponse.json(
      growthMediaGenerationSafetyJson({
        ok: true,
        job,
        qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
