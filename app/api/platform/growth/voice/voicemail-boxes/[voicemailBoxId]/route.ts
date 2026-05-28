import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateVoiceVoicemailBox } from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  greetingText: z.string().trim().max(4000).optional(),
  notificationEmail: z.string().trim().email().or(z.literal("")).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  retentionDays: z.number().int().min(0).max(3650).optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ voicemailBoxId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { voicemailBoxId } = await context.params
  if (!UUID_RE.test(voicemailBoxId)) return voiceInvalidIdResponse("Voicemail box").response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid voicemail box update." }, { status: 400 })
  }

  const voicemailBox = await updateVoiceVoicemailBox(ctx.admin, ctx.organizationId, voicemailBoxId, parsed.data)
  if (!voicemailBox) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Voicemail box not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, voicemailBox })
}
