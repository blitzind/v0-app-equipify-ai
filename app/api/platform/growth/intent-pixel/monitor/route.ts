import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchLiveVisitorMonitorSnapshot } from "@/lib/growth/intent-pixel/live-visitor-monitor"
import { GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim() || "equipify-sandbox"

  const snapshot = await fetchLiveVisitorMonitorSnapshot(access.admin, siteKey)

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LIVE_VISITOR_MONITOR_QA_MARKER,
    snapshot,
  })
}
