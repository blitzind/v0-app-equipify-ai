import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { canUseGrowthOutboundSoloApproval } from "@/lib/growth/runtime/outbound-solo-approval"
import { approveSequenceExecutionJobSolo } from "@/lib/growth/sequences/execution/approve-sequence-execution-solo"
import { approveSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ jobId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { jobId } = await context.params
  if (!jobId) {
    return NextResponse.json({ error: "invalid_job", message: "Job id required." }, { status: 400 })
  }

  const soloEnabled = canUseGrowthOutboundSoloApproval({ platformAdmin: true })

  try {
    const result = soloEnabled
      ? await approveSequenceExecutionJobSolo(access.admin, {
          jobId,
          approvedBy: access.userId,
          actorEmail: access.userEmail,
          platformAdmin: true,
        })
      : await approveSequenceExecutionJob(access.admin, {
          jobId,
          approvedBy: access.userId,
          actorEmail: access.userEmail,
        })

    if (!result.ok) {
      const status =
        result.message === "solo_approval_not_enabled"
          ? 403
          : ["job_not_found", "missing_generation"].includes(result.message ?? "")
            ? 404
            : 400
      return NextResponse.json({ error: result.message ?? "approve_failed", message: result.message ?? "Approve failed." }, { status })
    }

    return NextResponse.json({
      ok: true,
      result,
      soloApproval: soloEnabled,
    })
  } catch {
    return NextResponse.json({ error: "approve_failed", message: "Could not approve job." }, { status: 500 })
  }
}
