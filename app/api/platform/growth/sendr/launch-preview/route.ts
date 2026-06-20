import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_LAUNCH_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { computeSendrLaunchPreview } from "@/lib/growth/sendr/growth-sendr-launch-preview-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const BodySchema = z.object({
  audienceId: z.string().uuid(),
  sequencePatternId: z.string().uuid(),
  landingPageId: z.string().uuid(),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const preview = await computeSendrLaunchPreview(access.admin, {
      organizationId: access.organizationId,
      audienceId: parsed.data.audienceId,
      sequencePatternId: parsed.data.sequencePatternId,
      landingPageId: parsed.data.landingPageId,
    })
    return NextResponse.json({ ok: true, preview, qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER })
  } catch (error) {
    const message = error instanceof Error ? error.message : "launch_preview_failed"
    const status =
      message.includes("cap") || message.includes("budget") || message.includes("disabled") ? 429 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
