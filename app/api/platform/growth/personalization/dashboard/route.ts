import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthAiPersonalizationDashboard } from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthAiPersonalizationDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
