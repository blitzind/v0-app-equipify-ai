import { NextResponse } from "next/server"
import {
  growthMediaGenerationJobCreateSchema,
  growthMediaGenerationJobListQuerySchema,
} from "@/lib/growth/media/growth-media-generation-api-schema"
import {
  createMediaGenerationJob,
  listMediaGenerationJobs,
  summarizeMediaGenerationJobs,
} from "@/lib/growth/media/growth-media-generation-job-service"
import {
  growthMediaGenerationSafetyJson,
  mapGrowthMediaGenerationApiError,
  requireGrowthMediaGenerationPlatformAccess,
} from "@/lib/growth/media/growth-media-generation-platform-access"
import {
  GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
  type GrowthMediaGenerationStatus,
  type GrowthMediaGenerationType,
} from "@/lib/growth/media/growth-media-generation-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthMediaGenerationJobListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  )
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const [items, summary] = await Promise.all([
      listMediaGenerationJobs(access.admin, {
        organizationId: access.organizationId,
        status: parsed.data.status as GrowthMediaGenerationStatus | undefined,
        generationType: parsed.data.generation_type as GrowthMediaGenerationType | undefined,
        videoPageId: parsed.data.video_page_id,
        limit: parsed.data.limit,
      }),
      summarizeMediaGenerationJobs(access.admin, access.organizationId),
    ])

    return NextResponse.json(
      growthMediaGenerationSafetyJson({
        ok: true,
        items,
        summary,
        qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthMediaGenerationPlatformAccess()
  if (!access.ok) return access.response

  const parsed = growthMediaGenerationJobCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const run = await createMediaGenerationJob(access.admin, {
      organizationId: access.organizationId,
      createdBy: access.userId,
      generationType: parsed.data.generation_type as GrowthMediaGenerationType,
      provider: parsed.data.provider,
      metadataHooks: parsed.data.metadata_hooks,
      providerRequest: parsed.data.provider_request,
      writebackTarget: parsed.data.writeback_target ?? null,
      notes: parsed.data.notes ?? null,
    })

    return NextResponse.json(
      growthMediaGenerationSafetyJson({
        ok: true,
        job: run,
        qa_marker: GROWTH_MEDIA_GENERATION_JOBS_QA_MARKER,
      }),
    )
  } catch (error) {
    return mapGrowthMediaGenerationApiError(error)
  }
}
