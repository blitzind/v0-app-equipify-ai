import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateVoiceNumber } from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_NUMBER_STATUSES, VOICE_ROUTING_MODES, VOICE_OPERATIONS_QA_MARKER, VOICE_RECORDING_POLICIES } from "@/lib/voice/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  displayName: z.string().trim().max(200).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  defaultForwardingTarget: z.string().trim().max(40).optional(),
  routingMode: z.enum(VOICE_ROUTING_MODES).nullable().optional(),
  routingProfileId: z.string().uuid().nullable().optional(),
  status: z.enum(VOICE_NUMBER_STATUSES).optional(),
  voiceEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  recordingPolicy: z.enum(VOICE_RECORDING_POLICIES).nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ numberId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { numberId } = await context.params
  if (!UUID_RE.test(numberId)) return voiceInvalidIdResponse("Number").response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid number update payload." }, { status: 400 })
  }

  const number = await updateVoiceNumber(ctx.admin, ctx.organizationId, numberId, parsed.data)
  if (!number) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Voice number not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, number })
}
