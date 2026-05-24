import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRevenueExecutiveCommandSummary } from "@/lib/growth/revenue-operating/revenue-operating-dashboard-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const summary = await fetchGrowthRevenueExecutiveCommandSummary(access.admin)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load executive revenue summary."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
