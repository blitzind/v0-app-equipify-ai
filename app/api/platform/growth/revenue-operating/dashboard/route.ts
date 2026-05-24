import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recomputeGrowthRevenueOperatingDashboard } from "@/lib/growth/revenue-operating/revenue-operating-dashboard-repository"
import { GROWTH_REVENUE_FORECAST_PERIODS } from "@/lib/growth/revenue-operating/revenue-operating-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const periodParam = url.searchParams.get("period")
  const period =
    periodParam &&
    GROWTH_REVENUE_FORECAST_PERIODS.includes(periodParam as (typeof GROWTH_REVENUE_FORECAST_PERIODS)[number])
      ? (periodParam as (typeof GROWTH_REVENUE_FORECAST_PERIODS)[number])
      : undefined

  const refresh = url.searchParams.get("refresh") === "true"
  const start = url.searchParams.get("start") ?? undefined
  const end = url.searchParams.get("end") ?? undefined
  const customRange = start && end ? { start, end } : undefined

  try {
    const dashboard = await recomputeGrowthRevenueOperatingDashboard(access.admin, {
      period,
      customRange,
      refresh,
    })
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load revenue operating dashboard."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const body = z
      .object({
        period: z.enum(GROWTH_REVENUE_FORECAST_PERIODS).optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .parse(await request.json().catch(() => ({})))

    const dashboard = await recomputeGrowthRevenueOperatingDashboard(access.admin, {
      period: body.period,
      customRange: body.start && body.end ? { start: body.start, end: body.end } : undefined,
      refresh: true,
    })
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not refresh revenue forecast."
    return NextResponse.json({ error: "refresh_failed", message }, { status: 500 })
  }
}
