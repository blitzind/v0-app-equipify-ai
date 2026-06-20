import { NextResponse } from "next/server"
import { z } from "zod"
import { startAudienceEnrollmentRun } from "@/lib/growth/audiences/growth-audience-enrollment-run-service"
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
  memberIds: z.array(z.string().uuid()).optional(),
  enrollAll: z.boolean().optional(),
  startImmediately: z.boolean().optional(),
  dryRun: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ audienceId: string }> }

/** Legacy enroll endpoint — delegates to resumable enrollment runs (GS-RG-2C). */
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
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const progress = await startAudienceEnrollmentRun(access.admin, {
      audienceId,
      organizationId: access.organizationId,
      userId: access.userId,
      userEmail: access.userEmail,
      snapshotId: parsed.data.snapshotId,
      sequencePatternId: parsed.data.sequencePatternId,
      memberIds: parsed.data.memberIds,
      enrollAll: parsed.data.enrollAll,
      startImmediately: parsed.data.startImmediately,
      dryRun: parsed.data.dryRun,
    })

    const blocked = progress.status === "throttled"
    return NextResponse.json(
      {
        ok: !blocked,
        progress,
        result: {
          qaMarker: GROWTH_AUDIENCE_QA_MARKER,
          audienceId,
          snapshotId: parsed.data.snapshotId,
          requested: progress.requestedCount,
          enrollable: progress.requestedCount,
          skippedNoLead: 0,
          bulk: null,
          blocked,
          reason: progress.error,
        },
        qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      },
      { status: blocked ? 429 : 200 },
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "enroll_failed" },
      { status: 500 },
    )
  }
}
