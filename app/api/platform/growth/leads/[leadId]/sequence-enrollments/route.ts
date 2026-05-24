import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  createGrowthSequenceEnrollmentDraft,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { fetchActiveGrowthSequenceEnrollmentForLead } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"
import { describeSequenceStartUnavailable } from "@/lib/growth/sequence-enrollment/sequence-enrollment-ui"

export const runtime = "nodejs"

const PostSchema = z.object({
  patternId: z.string().uuid().optional(),
})

function mapError(message: string) {
  if (message === "not_found") return { status: 404, code: message, message: "Not found." }
  if (["preflight_blocked", "fatigue_blocked", "active_enrollment", "pattern_required", "pattern_not_found", "lead_blocked", "low_confidence"].includes(message)) {
    return { status: 409, code: message, message: "Sequence enrollment blocked." }
  }
  return { status: 400, code: "enrollment_failed", message }
}

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const url = new URL(request.url)
  const preflightPatternId = url.searchParams.get("preflightPatternId")

  const [lead, enrollment] = await Promise.all([
    fetchGrowthLeadById(access.admin, leadId),
    fetchActiveGrowthSequenceEnrollmentForLead(access.admin, leadId),
  ])

  if (!lead) {
    return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
  }

  const recommendedPreflight = await runSequenceEnrollmentPreflight(access.admin, lead, {
    patternId: lead.recommendedSequencePatternId,
  })

  const testPreflight = preflightPatternId
    ? await runSequenceEnrollmentPreflight(access.admin, lead, { patternId: preflightPatternId })
    : null

  const startAvailability = describeSequenceStartUnavailable(lead, {
    hasEnrollment: enrollment != null,
    enrollmentStatus: enrollment?.status ?? null,
    preflightCode: recommendedPreflight.allowed ? null : recommendedPreflight.code ?? null,
    preflightReason: recommendedPreflight.reason ?? null,
  })

  return NextResponse.json({
    ok: true,
    enrollment,
    sequence: {
      recommendedPatternId: lead.recommendedSequencePatternId,
      recommendedReason: lead.recommendedSequenceReason,
      recommendedConfidence: lead.recommendedSequenceConfidence,
      activeEnrollmentId: lead.activeSequenceEnrollmentId,
      fatigueRisk: lead.sequenceFatigueRisk,
      computedAt: lead.recommendedSequenceComputedAt,
    },
    startAvailability,
    recommendedPreflight,
    testPreflight,
  })
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const parsed = PostSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const enrollment = await createGrowthSequenceEnrollmentDraft(access.admin, {
      leadId,
      patternId: parsed.data.patternId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (e) {
    const code = e instanceof Error ? e.message : "enrollment_failed"
    const mapped = mapError(code)
    return NextResponse.json({ error: mapped.code, message: mapped.message }, { status: mapped.status })
  }
}
