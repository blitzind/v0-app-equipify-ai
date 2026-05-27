import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { skipSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"

export const runtime = "nodejs"

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
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
    return NextResponse.json({ error: "invalid_body", message: "Invalid skip payload." }, { status: 400 })
  }

  try {
    const result = await skipSequenceExecutionJob(access.admin, {
      jobId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
      reason: parsed.data.reason,
    })
    return NextResponse.json({ ok: result.ok, result })
  } catch {
    return NextResponse.json({ error: "skip_failed", message: "Could not skip job." }, { status: 500 })
  }
}
