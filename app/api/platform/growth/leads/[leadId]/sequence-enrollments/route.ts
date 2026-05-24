import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createGrowthSequenceEnrollmentDraft,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { fetchActiveGrowthSequenceEnrollmentForLead } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"

export const runtime = "nodejs"

const PostSchema = z.object({
  patternId: z.string().uuid().optional(),
})

function mapError(message: string) {
  if (message === "not_found") return { status: 404, code: message, message: "Not found." }
  if (["preflight_blocked", "fatigue_blocked", "active_enrollment", "pattern_required", "pattern_not_found", "lead_blocked"].includes(message)) {
    return { status: 409, code: message, message: "Sequence enrollment blocked." }
  }
  return { status: 400, code: "enrollment_failed", message }
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const enrollment = await fetchActiveGrowthSequenceEnrollmentForLead(access.admin, leadId)
  return NextResponse.json({ ok: true, enrollment })
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
