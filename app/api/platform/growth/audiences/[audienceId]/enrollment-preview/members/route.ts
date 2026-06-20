import { NextResponse } from "next/server"
import { listGrowthAudienceEnrollmentPreviewMembers } from "@/lib/growth/audiences/growth-audience-enrollment-repository"
import { getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ audienceId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  const url = new URL(request.url)
  const previewId = url.searchParams.get("previewId")
  if (!previewId) {
    return NextResponse.json({ ok: false, error: "preview_id_required" }, { status: 400 })
  }

  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const category = url.searchParams.get("category") ?? undefined
    const result = await listGrowthAudienceEnrollmentPreviewMembers(access.admin, {
      previewId,
      category: category as Parameters<typeof listGrowthAudienceEnrollmentPreviewMembers>[1]["category"],
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })

    return NextResponse.json({
      ok: true,
      ...result,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "preview_members_failed" },
      { status: 500 },
    )
  }
}
