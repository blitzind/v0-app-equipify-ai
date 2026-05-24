import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthOpportunityPipelineSettings,
  updateGrowthOpportunityPipelineSettings,
} from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import type { GrowthOpportunityPipelineStage } from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const settings = await fetchGrowthOpportunityPipelineSettings(access.admin)
    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load pipeline settings."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const body = (await request.json()) as {
      stages?: GrowthOpportunityPipelineStage[]
      stageProbabilityOverrides?: Record<string, number>
      staleStageDays?: number
      staleActivityDays?: number
    }

    if (body.staleStageDays != null) z.number().int().min(1).parse(body.staleStageDays)
    if (body.staleActivityDays != null) z.number().int().min(1).parse(body.staleActivityDays)

    const settings = await updateGrowthOpportunityPipelineSettings(access.admin, {
      stages: body.stages,
      stageProbabilityOverrides: body.stageProbabilityOverrides,
      staleStageDays: body.staleStageDays,
      staleActivityDays: body.staleActivityDays,
      updatedBy: access.userEmail ?? access.userId,
    })

    return NextResponse.json({ ok: true, settings })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not update pipeline settings."
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
