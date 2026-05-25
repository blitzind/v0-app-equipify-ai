import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { startGrowthExecutionSprintSession } from "@/lib/growth/execution/execution-service"
import {
  EXECUTION_SPRINT_DURATIONS,
  EXECUTION_SPRINT_TYPES,
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  type ExecutionSprintDuration,
  type ExecutionSprintType,
} from "@/lib/growth/execution/execution-priority-types"

export const runtime = "nodejs"

type StartSprintBody = {
  sprintType?: ExecutionSprintType
  durationMinutes?: ExecutionSprintDuration
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  let body: StartSprintBody = {}
  try {
    body = (await request.json()) as StartSprintBody
  } catch {
    body = {}
  }

  const sprintType = body.sprintType ?? "revenue_rescue"
  const durationMinutes = body.durationMinutes ?? 30

  if (!EXECUTION_SPRINT_TYPES.includes(sprintType)) {
    return NextResponse.json({ error: "invalid_sprint_type", message: "Invalid sprint type." }, { status: 400 })
  }
  if (!EXECUTION_SPRINT_DURATIONS.includes(durationMinutes)) {
    return NextResponse.json({ error: "invalid_duration", message: "Duration must be 30, 60, or 90 minutes." }, { status: 400 })
  }

  try {
    const result = await startGrowthExecutionSprintSession(access.admin, {
      startedByUserId: access.userId ?? null,
      sprintType,
      durationMinutes,
    })
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
      ...result,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start execution sprint."
    return NextResponse.json({ error: "start_failed", message }, { status: 500 })
  }
}
