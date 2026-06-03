import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchRevenueExecutionTimeline } from "@/lib/growth/revenue-execution/revenue-timeline"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")
  if (!leadId) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 })

  try {
    const timeline = await fetchRevenueExecutionTimeline(access.admin, leadId)
    return NextResponse.json({ ok: true, timeline })
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
