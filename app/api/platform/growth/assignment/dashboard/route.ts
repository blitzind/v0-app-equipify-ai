import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSalesOwnershipDashboard } from "@/lib/growth/assignment/assignment-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthSalesOwnershipDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load ownership dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
