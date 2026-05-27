import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getSequenceExperiment,
  updateSequenceExperiment,
} from "@/lib/growth/experiments/experiment-repository"
import { listExperimentResultCounts } from "@/lib/growth/experiments/experiment-metrics"
import { buildExperimentResultRows, evaluateExperimentWinnerRecommendation } from "@/lib/growth/experiments/experiment-winner"
import { listSequenceExperimentEvents } from "@/lib/growth/experiments/experiment-events"
import { isGrowthSequenceAbTestingSchemaReady } from "@/lib/growth/experiments/experiment-schema-health"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  minimumSampleSize: z.number().int().min(10).max(100000).optional(),
  confidenceThreshold: z.number().min(0.5).max(0.999).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const experiment = await getSequenceExperiment(access.admin, id)
    if (!experiment) {
      return NextResponse.json({ error: "experiment_not_found", message: "Experiment not found." }, { status: 404 })
    }
    const rawCounts = await listExperimentResultCounts(access.admin, id)
    const results = buildExperimentResultRows(experiment.variants ?? [], rawCounts)
    const recommendation = evaluateExperimentWinnerRecommendation({
      experiment,
      variants: experiment.variants ?? [],
      results,
    })
    const events = await listSequenceExperimentEvents(access.admin, id)
    return NextResponse.json({ ok: true, experiment, results, recommendation, events })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load experiment." }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid experiment update." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const experiment = await updateSequenceExperiment(access.admin, id, parsed.data)
    return NextResponse.json({ ok: true, experiment })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update experiment."
    const status = message === "experiment_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
