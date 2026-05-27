import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchExecutiveRevenueOpsDashboard } from "@/lib/growth/revenue-intelligence/executive-revenue-ops-dashboard"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchExecutiveRevenueOpsDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load revenue ops dashboard." }, { status: 500 })
  }
}
