import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { fetchGrowthSenderPoolDashboard } from "@/lib/growth/sender-pools/sender-pool-dashboard"
import { isGrowthSenderPoolIntelligenceSchemaReady } from "@/lib/growth/sender-pools/sender-pool-schema-health"
import { GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE } from "@/lib/growth/sender-pools/sender-pool-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderPoolIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const poolId = new URL(request.url).searchParams.get("poolId") ?? undefined
  try {
    const dashboard = await fetchGrowthSenderPoolDashboard(access.admin, { poolId })
    return NextResponse.json({
      ok: true,
      dashboard,
      privacy_note: GROWTH_SENDER_POOL_INTELLIGENCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
