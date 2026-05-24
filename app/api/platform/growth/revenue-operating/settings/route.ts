import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthRevenueForecastSettings,
  updateGrowthRevenueForecastSettings,
} from "@/lib/growth/revenue-operating/revenue-settings-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await fetchGrowthRevenueForecastSettings(access.admin)
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load revenue forecast settings."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const body = z
      .object({
        monthlyGoal: z.number().min(0).optional(),
        quarterlyGoal: z.number().min(0).optional(),
        defaultForecastPeriod: z
          .enum(["this_month", "next_month", "this_quarter", "next_quarter"])
          .optional(),
        staleDealThresholdDays: z.number().int().min(1).optional(),
        coverageTargetMultiplier: z.number().min(0.1).optional(),
        highValueDealThreshold: z.number().min(0).optional(),
      })
      .parse(await request.json())

    const settings = await updateGrowthRevenueForecastSettings(access.admin, {
      ...body,
      defaultForecastPeriod: body.defaultForecastPeriod as
        | "this_month"
        | "next_month"
        | "this_quarter"
        | "next_quarter"
        | undefined,
      updatedBy: access.userEmail ?? access.userId,
    })
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_body", message: "Invalid settings." }, { status: 400 })
    }
    const message = e instanceof Error ? e.message : "Could not update revenue forecast settings."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
