import { NextResponse } from "next/server"
import { z } from "zod"
import {
  cancelAudienceEnrollmentPreview,
  continueAudienceEnrollmentPreview,
  startAudienceEnrollmentPreview,
} from "@/lib/growth/audiences/growth-audience-enrollment-preview-service"
import { getGrowthAudienceEnrollmentPreview } from "@/lib/growth/audiences/growth-audience-enrollment-repository"
import { getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"

export const runtime = "nodejs"

const BodySchema = z.object({
  snapshotId: z.string().uuid(),
  sequencePatternId: z.string().uuid(),
  previewId: z.string().uuid().optional(),
  cancel: z.boolean().optional(),
  sendrLandingPageId: z.string().uuid().optional(),
})

type RouteContext = { params: Promise<{ audienceId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  const previewId = new URL(request.url).searchParams.get("previewId")
  if (!previewId) {
    return NextResponse.json({ ok: false, error: "preview_id_required" }, { status: 400 })
  }

  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const preview = await getGrowthAudienceEnrollmentPreview(access.admin, previewId)
    if (!preview || preview.audienceId !== audienceId) {
      return NextResponse.json({ ok: false, error: "preview_not_found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, preview, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "preview_load_failed" },
      { status: 500 },
    )
  }
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    if (parsed.data.cancel && parsed.data.previewId) {
      const progress = await cancelAudienceEnrollmentPreview(access.admin, {
        previewId: parsed.data.previewId,
        audienceId,
      })
      return NextResponse.json({ ok: true, progress, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
    }

    let progress
    if (parsed.data.previewId) {
      progress = await continueAudienceEnrollmentPreview(access.admin, {
        audienceId,
        organizationId: access.organizationId,
        previewId: parsed.data.previewId,
        sequencePatternId: parsed.data.sequencePatternId,
        sendrLandingPageId: parsed.data.sendrLandingPageId,
      })
    } else {
      progress = await startAudienceEnrollmentPreview(access.admin, {
        audienceId,
        organizationId: access.organizationId,
        userId: access.userId,
        snapshotId: parsed.data.snapshotId,
        sequencePatternId: parsed.data.sequencePatternId,
        sendrLandingPageId: parsed.data.sendrLandingPageId,
      })
    }

    return NextResponse.json({ ok: true, progress, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "preview_failed" },
      { status: 500 },
    )
  }
}
