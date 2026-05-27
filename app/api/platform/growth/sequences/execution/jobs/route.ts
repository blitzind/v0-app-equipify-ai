import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  enrichSequenceExecutionJobViews,
  listSequenceExecutionJobs,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import type { GrowthSequenceExecutionJobStatus } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES } from "@/lib/growth/sequences/execution/sequence-execution-types"

export const runtime = "nodejs"

const SAFE_MESSAGE = "Could not load sequence execution jobs."

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const statusParam = url.searchParams.get("status")
  const status = GROWTH_SEQUENCE_EXECUTION_JOB_STATUSES.includes(statusParam as GrowthSequenceExecutionJobStatus)
    ? (statusParam as GrowthSequenceExecutionJobStatus)
    : undefined
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 200)

  try {
    const jobs = await listSequenceExecutionJobs(access.admin, { limit, status })
    const views = await enrichSequenceExecutionJobViews(access.admin, jobs)
    return NextResponse.json({ ok: true, jobs: views })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: SAFE_MESSAGE }, { status: 500 })
  }
}
