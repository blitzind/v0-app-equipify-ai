import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchRevenueCommandCenterDashboard } from "@/lib/growth/revenue-execution/revenue-command-center"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchRevenueCommandCenterDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
