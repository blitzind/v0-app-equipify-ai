import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthExecutionQueueView } from "@/lib/growth/execution/execution-service"
import { GROWTH_REVENUE_EXECUTION_QA_MARKER } from "@/lib/growth/execution/execution-priority-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const queue = await fetchGrowthExecutionQueueView(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
      queue,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load execution queue."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
