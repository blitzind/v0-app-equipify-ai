import { NextResponse } from "next/server"
import { requireGrowthQaAccelerationAccess } from "@/lib/growth/access"
import {
  explainQaSchedulerNoJobCreated,
  qaRunGrowthEnrollmentSchedulerNow,
} from "@/lib/growth/sequence-enrollment/qa-acceleration"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const access = await requireGrowthQaAccelerationAccess()
  if (!access.ok) return access.response

  const { enrollmentId } = await context.params
  try {
    const result = await qaRunGrowthEnrollmentSchedulerNow(access.admin, {
      enrollmentId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    const reasons = result.jobCreated
      ? []
      : explainQaSchedulerNoJobCreated({
          blockReason: result.blockReason,
          schedulerResult: result.schedulerResult,
        })
    return NextResponse.json({ ok: true, result, reasons })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scheduler run failed."
    return NextResponse.json({ error: "qa_action_failed", message }, { status: 400 })
  }
}
