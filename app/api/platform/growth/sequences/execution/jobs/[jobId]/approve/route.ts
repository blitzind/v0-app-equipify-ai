import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
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

  try {
    const result = await approveSequenceExecutionJob(access.admin, {
      jobId,
      approvedBy: access.userId,
    })
    if (!result.ok) {
      return NextResponse.json({ error: "approve_failed", message: result.message ?? "Approve failed." }, { status: 400 })
    }
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: "approve_failed", message: "Could not approve job." }, { status: 500 })
  }
}
