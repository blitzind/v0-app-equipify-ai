import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { reviewVoiceMemoryDraft } from "@/lib/voice/relationship-memory/relationship-memory-service"
import { VOICE_RELATIONSHIP_MEMORY_DRAFT_ACTIONS, VOICE_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/voice/relationship-memory/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  action: z.enum(VOICE_RELATIONSHIP_MEMORY_DRAFT_ACTIONS),
  operatorNotes: z.string().max(2000).optional().nullable(),
  primaryPhoneNumber: z.string().max(32).optional().nullable(),
  primaryContactName: z.string().max(200).optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ draftId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { draftId } = await context.params
  if (!UUID_RE.test(draftId)) return voiceInvalidIdResponse("draftId").response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid review action." }, { status: 400 })
  }

  try {
    const result = await reviewVoiceMemoryDraft(ctx.admin, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      draftId,
      action: parsed.data.action,
      operatorNotes: parsed.data.operatorNotes,
      primaryPhoneNumber: parsed.data.primaryPhoneNumber,
      primaryContactName: parsed.data.primaryContactName,
      leadId: parsed.data.leadId,
    })
    return NextResponse.json({ ok: true, qaMarker: VOICE_RELATIONSHIP_MEMORY_QA_MARKER, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "review_failed", message }, { status: 400 })
  }
}
