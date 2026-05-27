import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthSequenceIntelligenceList } from "@/lib/growth/revenue-intelligence/dashboard"
import { isGrowthRevenueSequenceIntelligenceSchemaReady } from "@/lib/growth/revenue-intelligence/schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthRevenueSequenceIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const sequences = await fetchGrowthSequenceIntelligenceList(access.admin)
    return NextResponse.json({ ok: true, sequences })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load sequence intelligence." }, { status: 500 })
  }
}
