import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRevenueForecastDashboard } from "@/lib/growth/revenue-forecast-dashboard-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthRevenueForecastDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
