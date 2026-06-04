import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchOutreachPerformanceDashboard } from "@/lib/growth/outreach/performance/performance-dashboard-repository"
import { buildOutreachPerformanceExperimentReadiness } from "@/lib/growth/outreach/performance/experiment-readiness"
import {
  GROWTH_OUTREACH_PERFORMANCE_PRIVACY_NOTE,
} from "@/lib/growth/outreach/performance/performance-types"
import { isGrowthOutreachPerformanceSchemaReady } from "@/lib/growth/outreach/performance/schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthOutreachPerformanceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const measurementWindowDays = Number(url.searchParams.get("windowDays") ?? "14")

  try {
    const dashboard = await fetchOutreachPerformanceDashboard(access.admin, {
      measurementWindowDays: Number.isFinite(measurementWindowDays) ? measurementWindowDays : 14,
    })
    const experimentReadiness = buildOutreachPerformanceExperimentReadiness()

    return NextResponse.json({
      ok: true,
      dashboard,
      experimentReadiness,
      privacy_note: GROWTH_OUTREACH_PERFORMANCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
