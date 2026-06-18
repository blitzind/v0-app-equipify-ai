import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { applySequencePreviewAction } from "@/lib/growth/sequence-preview/sequence-preview-service"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"
import {
  SEQUENCE_PREVIEW_ACTIONS,
  type SequencePreview,
} from "@/lib/growth/sequence-preview/sequence-preview-types"

export const runtime = "nodejs"
export const maxDuration = 120

const ActionSchema = z.object({
  action: z.enum(SEQUENCE_PREVIEW_ACTIONS),
  preview: z.custom<SequencePreview>(),
})

export async function POST(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("sequencePreviewStudio", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = ActionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await applySequencePreviewAction(access.admin, {
      action: parsed.data.action,
      preview: parsed.data.preview,
      operator_id: access.userId,
    })
    return NextResponse.json({
      ok: result.ok,
      error: result.error ?? null,
      outreach_execution: false,
      enrollment_execution: false,
      auto_reply: false,
      requires_human_review: true,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "sequence_preview_action_failed", message }, { status: 500 })
  }
}
