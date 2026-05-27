import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { promoteSequenceExperimentWinner } from "@/lib/growth/experiments/experiment-repository"
import { isGrowthSequenceAbTestingSchemaReady } from "@/lib/growth/experiments/experiment-schema-health"
import { GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE } from "@/lib/growth/experiments/experiment-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  variantId: z.string().uuid(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSequenceAbTestingSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "variantId is required." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const experiment = await promoteSequenceExperimentWinner(access.admin, {
      experimentId: id,
      variantId: parsed.data.variantId,
      promotedBy: access.userId,
    })
    return NextResponse.json({ ok: true, experiment, privacy_note: GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not promote winner."
    const status =
      message === "experiment_not_found" || message === "variant_not_found" ? 404 : message === "invalid_status" ? 400 : 500
    return NextResponse.json({ error: "promote_failed", message }, { status })
  }
}
