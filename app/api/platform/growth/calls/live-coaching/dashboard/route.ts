import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthLiveCoachingDashboard } from "@/lib/growth/live-guidance/live-coaching-dashboard-repository"
import { buildLiveCoachingDashboardQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthLiveCoachingDashboard(access.admin)
    const qaProof = buildLiveCoachingDashboardQaProofMarker({
      completedSessions: dashboard.stats.completedSessions,
    })
    return NextResponse.json({ ok: true, dashboard, qaProof })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
