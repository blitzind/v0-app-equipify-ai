import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { resumeGrowthSequenceEnrollment } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ leadId: string; enrollmentId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, enrollmentId } = await context.params
  try {
    const enrollment = await resumeGrowthSequenceEnrollment(access.admin, {
      leadId,
      enrollmentId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, enrollment })
  } catch (e) {
    const code = e instanceof Error ? e.message : "resume_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
