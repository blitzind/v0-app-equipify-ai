import { NextResponse } from "next/server"
import { z } from "zod"
import { getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import {
  continueAudienceSnapshotGeneration,
  startAudienceSnapshotGeneration,
} from "@/lib/growth/audiences/growth-audience-snapshot-service"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"

export const runtime = "nodejs"

const BodySchema = z.object({
  refreshRunId: z.string().uuid().optional(),
})

type RouteContext = { params: Promise<{ audienceId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))

  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const progress = parsed.success && parsed.data.refreshRunId
      ? await continueAudienceSnapshotGeneration(access.admin, {
          audienceId,
          organizationId: access.organizationId,
          userId: access.userId,
          refreshRunId: parsed.data.refreshRunId,
        })
      : await startAudienceSnapshotGeneration(access.admin, {
          audienceId,
          organizationId: access.organizationId,
          userId: access.userId,
          isRefresh: true,
        })

    return NextResponse.json({
      ok: true,
      progress,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "refresh_failed" },
      { status: 500 },
    )
  }
}
