import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateVoiceRoutingProfile } from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER, VOICE_ROUTING_MODES } from "@/lib/voice/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  routingMode: z.enum(VOICE_ROUTING_MODES).optional(),
  fallbackMode: z.enum(VOICE_ROUTING_MODES).optional(),
  fallbackPhoneNumber: z.string().trim().max(40).optional(),
  voicemailBoxId: z.string().uuid().nullable().optional(),
  businessHoursId: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ profileId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { profileId } = await context.params
  if (!UUID_RE.test(profileId)) return voiceInvalidIdResponse("Routing profile").response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid routing profile update." }, { status: 400 })
  }

  const profile = await updateVoiceRoutingProfile(ctx.admin, ctx.organizationId, profileId, parsed.data)
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Routing profile not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, profile })
}
