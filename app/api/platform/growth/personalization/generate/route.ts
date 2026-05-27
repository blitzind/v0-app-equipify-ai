import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { generatePersonalizationDraft } from "@/lib/growth/personalization/dashboard"
import { isGrowthAiPersonalizationSchemaReady } from "@/lib/growth/personalization/schema-health"
import { GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE } from "@/lib/growth/personalization/personalization-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadId: z.string().uuid(),
  contentTemplateVersionId: z.string().uuid().optional().nullable(),
  snippetIds: z.array(z.string().uuid()).optional(),
  sequenceExecutionJobId: z.string().uuid().optional().nullable(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthAiPersonalizationSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", message: parsed.error.message }, { status: 400 })
  }

  try {
    const generation = await generatePersonalizationDraft(access.admin, {
      leadId: parsed.data.leadId,
      actorUserId: access.userId,
      actorEmail: access.userEmail,
      contentTemplateVersionId: parsed.data.contentTemplateVersionId ?? null,
      snippetIds: parsed.data.snippetIds,
      sequenceExecutionJobId: parsed.data.sequenceExecutionJobId ?? null,
    })
    return NextResponse.json({
      ok: true,
      generation,
      privacy_note: GROWTH_AI_PERSONALIZATION_PRIVACY_NOTE,
      message: generation.status === "blocked" ? "Generation blocked — review risk events." : "Personalization draft generated.",
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "generate_failed", message }, { status: 500 })
  }
}
