import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import type { GrowthCadenceTaskOutcome } from "@/lib/growth/cadence/cadence-types"
import {
  completeGrowthSequenceEnrollmentStepManually,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; stepId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { stepId } = await context.params
  const body = (await request.json().catch(() => ({}))) as { cadenceOutcome?: string }
  try {
    await completeGrowthSequenceEnrollmentStepManually(access.admin, {
      stepId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      cadenceOutcome: body.cadenceOutcome as GrowthCadenceTaskOutcome | undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const code = e instanceof Error ? e.message : "complete_failed"
    return NextResponse.json({ error: code }, { status: 409 })
  }
}
