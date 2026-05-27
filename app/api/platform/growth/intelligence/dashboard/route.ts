import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRevenueIntelligenceDashboard } from "@/lib/growth/revenue-intelligence/dashboard"
import { isGrowthRevenueSequenceIntelligenceSchemaReady } from "@/lib/growth/revenue-intelligence/schema-health"
import { GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE } from "@/lib/growth/revenue-intelligence/revenue-intelligence-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthRevenueSequenceIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "growth_schema_incomplete", message: "Apply sequence revenue intelligence migration." },
      { status: 503 },
    )
  }

  try {
    const dashboard = await fetchGrowthRevenueIntelligenceDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_REVENUE_SEQUENCE_INTELLIGENCE_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load revenue intelligence dashboard." }, { status: 500 })
  }
}
