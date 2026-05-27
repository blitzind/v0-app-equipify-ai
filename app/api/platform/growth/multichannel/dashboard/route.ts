import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthMultichannelDashboard } from "@/lib/growth/multichannel/dashboard"
import { isGrowthMultichannelSequencesSchemaReady } from "@/lib/growth/multichannel/schema-health"
import { GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE } from "@/lib/growth/multichannel/multichannel-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthMultichannelSequencesSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const leadId = new URL(request.url).searchParams.get("leadId") ?? undefined
  try {
    const dashboard = await fetchGrowthMultichannelDashboard(access.admin, { leadId: leadId ?? undefined })
    return NextResponse.json({
      ok: true,
      dashboard,
      privacy_note: GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
