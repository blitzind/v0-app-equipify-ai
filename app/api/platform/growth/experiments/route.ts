import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { createSequenceExperiment, listSequenceExperiments } from "@/lib/growth/experiments/experiment-repository"
import { isGrowthSequenceAbTestingSchemaReady } from "@/lib/growth/experiments/experiment-schema-health"
import {
  GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE,
  GROWTH_SEQUENCE_EXPERIMENT_TYPES,
} from "@/lib/growth/experiments/experiment-types"

export const runtime = "nodejs"

const PostSchema = z.object({
  name: z.string().trim().min(1).max(200),
  experimentType: z.enum(GROWTH_SEQUENCE_EXPERIMENT_TYPES),
  sequenceId: z.string().uuid().nullable().optional(),
  sequenceStepId: z.string().uuid().nullable().optional(),
  minimumSampleSize: z.number().int().min(10).max(100000).optional(),
  confidenceThreshold: z.number().min(0.5).max(0.999).optional(),
  variants: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        isControl: z.boolean().optional(),
        payload: z.record(z.unknown()).optional(),
        weight: z.number().int().min(1).max(100).optional(),
      }),
    )
    .optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply sequence A/B testing migration." }, { status: 503 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get("status") ?? undefined

  try {
    const experiments = await listSequenceExperiments(access.admin, {
      status: status as never,
      limit: 100,
    })
    return NextResponse.json({ ok: true, experiments, privacy_note: GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load experiments." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply sequence A/B testing migration." }, { status: 503 })
  }

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid experiment payload." }, { status: 400 })
  }

  try {
    const experiment = await createSequenceExperiment(access.admin, {
      ...parsed.data,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, experiment, privacy_note: GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create experiment."
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
