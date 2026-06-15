import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSequencePreviewStudio } from "@/lib/growth/sequence-preview/sequence-preview-service"
import { SEQUENCE_PREVIEW_FILTERS } from "@/lib/growth/sequence-preview/sequence-preview-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  pattern_id: z.string().max(120).optional().nullable(),
  lead_id: z.string().max(120).optional().nullable(),
  filter: z.enum(SEQUENCE_PREVIEW_FILTERS).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  include_campaign_readiness: z.boolean().optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const studio = await fetchSequencePreviewStudio(access.admin, {
      ...parsed.data,
      persist_audit: true,
    })
    return NextResponse.json({
      ok: true,
      ...studio,
      outreach_enabled: false,
      enrollment_enabled: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "sequence_preview_generate_failed", message }, { status: 500 })
  }
}
