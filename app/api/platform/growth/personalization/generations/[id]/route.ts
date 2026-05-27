import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  getPersonalizationGenerationView,
  updatePersonalizationGeneration,
} from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(10000).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const generation = await getPersonalizationGenerationView(access.admin, id)
    if (!generation) {
      return NextResponse.json({ error: "generation_not_found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, generation, privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const generation = await updatePersonalizationGeneration(access.admin, id, {
      ...parsed.data,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({
      ok: true,
      generation,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: generation.status === "blocked" ? "Edit blocked — unsupported claims detected." : "Generation updated.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "generation_not_found"
        ? 404
        : message === "personalization_blocked"
          ? 400
          : 500
    return NextResponse.json({ error: "update_failed", message }, { status })
  }
}
