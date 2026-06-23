import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadGrowthAutonomyOutboundDashboard } from "@/lib/growth/autonomy/growth-autonomy-outbound-dashboard"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 400 })
  }

  const dashboard = await loadGrowthAutonomyOutboundDashboard(access.admin, organizationId)
  return NextResponse.json({ ok: true, dashboard })
}
