import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { pauseSequenceExperiment } from "@/lib/growth/experiments/experiment-repository"
import { isGrowthSequenceAbTestingSchemaReady } from "@/lib/growth/experiments/experiment-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const experiment = await pauseSequenceExperiment(access.admin, id)
    return NextResponse.json({ ok: true, experiment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not pause experiment."
    const status = message === "experiment_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "pause_failed", message }, { status })
  }
}
