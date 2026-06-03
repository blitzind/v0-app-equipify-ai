import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { restoreSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ jobId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { jobId } = await context.params
  if (!jobId) {
    return NextResponse.json({ error: "invalid_job", message: "Job id required." }, { status: 400 })
  }

  try {
    const result = await restoreSequenceExecutionJob(access.admin, {
      jobId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    if (!result.ok) {
      const status =
        result.message === "job_not_found"
          ? 404
          : ["delivery_attempt_exists", "active_job_exists", "subsequent_step_sent"].includes(result.message ?? "")
            ? 409
            : 400
      return NextResponse.json(
        { error: result.message ?? "restore_failed", message: result.message ?? "Restore failed." },
        { status },
      )
    }

    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: "restore_failed", message: "Could not restore job." }, { status: 500 })
  }
}
