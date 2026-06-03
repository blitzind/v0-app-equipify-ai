import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runGrowthSequenceScheduler } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import { isGrowthOutboundStandaloneMode } from "@/lib/growth/runtime/outbound-mode"
import { planSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-planner"

export const runtime = "nodejs"

const BodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid plan payload." }, { status: 400 })
  }

  try {
    if (isGrowthOutboundStandaloneMode()) {
      const result = await runGrowthSequenceScheduler(access.admin, {
        actingUserId: access.userId,
        actingUserEmail: access.userEmail,
        limit: parsed.data.limit,
        dryRun: false,
      })
      return NextResponse.json({
        ok: true,
        delegatedToScheduler: true,
        message:
          "Standalone mode plans through growth-sequence-scheduler (same path as the every-10-minute cron). Manual plan is optional.",
        result,
      })
    }

    const result = await planSequenceExecutionJobs(access.admin, {
      limit: parsed.data.limit,
      actingUserId: access.userId,
    })
    return NextResponse.json({ ok: true, result })
  } catch {
    return NextResponse.json({ error: "plan_failed", message: "Could not plan execution jobs." }, { status: 500 })
  }
}
