import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"

export const runtime = "nodejs"

const BodySchema = z.object({
  humanApproved: z.boolean().optional(),
  humanApprovalConfirmed: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ jobId: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { jobId } = await context.params
  if (!jobId) {
    return NextResponse.json({ error: "invalid_job", message: "Job id required." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid run payload." }, { status: 400 })
  }

  try {
    const result = await runSequenceExecutionJob(access.admin, {
      jobId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      humanApproved: parsed.data.humanApproved ?? true,
      humanApprovalConfirmed: parsed.data.humanApprovalConfirmed ?? true,
      approvedBy: access.userId,
    })
    return NextResponse.json({ ok: result.ok, result })
  } catch {
    return NextResponse.json({ error: "run_failed", message: "Could not run job." }, { status: 500 })
  }
}
