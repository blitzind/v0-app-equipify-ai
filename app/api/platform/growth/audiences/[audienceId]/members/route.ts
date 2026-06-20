import { NextResponse } from "next/server"
import {
  getGrowthAudience,
  listGrowthAudienceMembers,
} from "@/lib/growth/audiences/growth-audience-repository"
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
  const snapshotId = url.searchParams.get("snapshotId")

  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const resolvedSnapshotId = snapshotId ?? audience.lastSnapshotId
    if (!resolvedSnapshotId) {
      return NextResponse.json({
        ok: true,
        items: [],
        total: 0,
        qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      })
    }

    const result = await listGrowthAudienceMembers(access.admin, {
      snapshotId: resolvedSnapshotId,
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    })

    return NextResponse.json({
      ok: true,
      snapshotId: resolvedSnapshotId,
      items: result.items,
      total: result.total,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "members_failed" },
      { status: 500 },
    )
  }
}
