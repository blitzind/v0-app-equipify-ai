import { NextResponse } from "next/server"
import { requireGrowthQaAccelerationAccess } from "@/lib/growth/access"
import { qaForceGrowthEnrollmentStepDueNow } from "@/lib/growth/sequence-enrollment/qa-acceleration"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const access = await requireGrowthQaAccelerationAccess()
  if (!access.ok) return access.response

  const { enrollmentId } = await context.params
  try {
    const result = await qaForceGrowthEnrollmentStepDueNow(access.admin, {
      enrollmentId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not force step due now."
    return NextResponse.json({ error: "qa_action_failed", message }, { status: 400 })
  }
}
