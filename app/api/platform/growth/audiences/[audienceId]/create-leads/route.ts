import { NextResponse } from "next/server"
import { getGrowthAudience } from "@/lib/growth/audiences/growth-audience-repository"
import {
  continueAudienceLeadCreation,
  startAudienceLeadCreation,
} from "@/lib/growth/audiences/growth-audience-lead-creation-service"
import {
  assertAudienceOrgScope,
  requireAudiencePlatformAccess,
} from "@/lib/growth/audiences/growth-audience-platform-access"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ audienceId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAudiencePlatformAccess()
  if (!access.ok) return access.response

  const { audienceId } = await context.params
  try {
    const audience = await getGrowthAudience(access.admin, audienceId)
    if (!audience) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 })
    }
    const scope = assertAudienceOrgScope(audience, access.organizationId)
    if (scope) return scope

    const body = (await request.json()) as {
      snapshotId?: string
      memberIds?: string[]
      allWithoutLead?: boolean
      dryRun?: boolean
      runId?: string
    }

    const snapshotId = body.snapshotId ?? audience.lastSnapshotId
    if (!snapshotId) {
      return NextResponse.json({ ok: false, message: "snapshot_required" }, { status: 400 })
    }

    let progress
    if (body.runId) {
      progress = await continueAudienceLeadCreation(access.admin, {
        audienceId,
        organizationId: access.organizationId,
        runId: body.runId,
        dryRun: body.dryRun,
      })
    } else {
      progress = await startAudienceLeadCreation(access.admin, {
        audienceId,
        organizationId: access.organizationId,
        userId: access.userId,
        snapshotId,
        memberIds: body.memberIds,
        allWithoutLead: body.allWithoutLead,
        dryRun: body.dryRun,
      })
    }

    return NextResponse.json({
      ok: true,
      progress,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "lead_creation_failed" },
      { status: 500 },
    )
  }
}
