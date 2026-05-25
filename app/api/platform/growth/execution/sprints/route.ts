import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthExecutionSprintsView } from "@/lib/growth/execution/execution-service"
import { GROWTH_REVENUE_EXECUTION_QA_MARKER } from "@/lib/growth/execution/execution-priority-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const sprints = await fetchGrowthExecutionSprintsView(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
      sprints,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load execution sprints."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
