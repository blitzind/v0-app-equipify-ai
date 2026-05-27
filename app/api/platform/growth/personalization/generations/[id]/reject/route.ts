import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { rejectPersonalizationGeneration } from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const BodySchema = z.object({ reason: z.string().max(500).optional() })

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const generation = await rejectPersonalizationGeneration(access.admin, {
      generationId: id,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      reason: parsed.data.reason,
    })
    return NextResponse.json({
      ok: true,
      generation,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: "Personalization rejected.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "generation_not_found" ? 404 : 500
    return NextResponse.json({ error: "reject_failed", message }, { status })
  }
}
