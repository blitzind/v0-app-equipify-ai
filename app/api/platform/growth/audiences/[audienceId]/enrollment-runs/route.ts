import { NextResponse } from "next/server"
import { z } from "zod"
import {
  cancelAudienceEnrollmentRun,
  continueAudienceEnrollmentRun,
  startAudienceEnrollmentRun,
} from "@/lib/growth/audiences/growth-audience-enrollment-run-service"
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
  memberIds: z.array(z.string().uuid()).optional(),
  enrollEligible: z.boolean().optional(),
  enrollAll: z.boolean().optional(),
  startImmediately: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  runId: z.string().uuid().optional(),
  cancel: z.boolean().optional(),
  sendrLandingPageId: z.string().uuid().optional(),
})

type RouteContext = { params: Promise<{ audienceId: string }> }

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

    if (parsed.data.cancel && parsed.data.runId) {
      const progress = await cancelAudienceEnrollmentRun(access.admin, {
        runId: parsed.data.runId,
        audienceId,
      })
      return NextResponse.json({ ok: true, progress, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
    }

    let progress
    if (parsed.data.runId) {
      progress = await continueAudienceEnrollmentRun(access.admin, {
        audienceId,
        runId: parsed.data.runId,
        userId: access.userId,
        userEmail: access.userEmail,
      })
    } else {
      progress = await startAudienceEnrollmentRun(access.admin, {
        audienceId,
        organizationId: access.organizationId,
        userId: access.userId,
        userEmail: access.userEmail,
        snapshotId: parsed.data.snapshotId,
        sequencePatternId: parsed.data.sequencePatternId,
        previewId: parsed.data.previewId,
        memberIds: parsed.data.memberIds,
        enrollEligible: parsed.data.enrollEligible,
        enrollAll: parsed.data.enrollAll,
        startImmediately: parsed.data.startImmediately,
        dryRun: parsed.data.dryRun,
        sendrLandingPageId: parsed.data.sendrLandingPageId,
      })
    }

    return NextResponse.json({ ok: true, progress, qa_marker: GROWTH_AUDIENCE_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "enrollment_run_failed"
    const status = message.includes("budget") || message.includes("disabled") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
