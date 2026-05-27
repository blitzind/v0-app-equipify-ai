import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthOutboundOperationsDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
