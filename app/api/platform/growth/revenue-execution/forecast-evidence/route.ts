import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRevenueForecastEvidence } from "@/lib/growth/revenue-execution/forecast-evidence"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")
  if (!leadId) return NextResponse.json({ error: "missing_lead_id" }, { status: 400 })

  try {
    const evidence = await fetchGrowthRevenueForecastEvidence(access.admin, leadId)
    if (!evidence) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json({ ok: true, evidence })
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
}
