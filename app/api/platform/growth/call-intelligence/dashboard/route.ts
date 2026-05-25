import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthCallIntelligenceDashboard } from "@/lib/growth/call-intelligence/call-intelligence-service"
import { GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER } from "@/lib/growth/call-intelligence/call-intelligence-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthCallIntelligenceDashboard(access.admin)
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
      dashboard,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load call intelligence dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
