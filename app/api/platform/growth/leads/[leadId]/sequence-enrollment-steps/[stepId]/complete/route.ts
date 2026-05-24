import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  completeGrowthSequenceEnrollmentStepManually,
  skipGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ leadId: string; stepId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { stepId } = await context.params
  try {
    await completeGrowthSequenceEnrollmentStepManually(access.admin, {
      stepId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = e instanceof Error ? e.message : "complete_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
