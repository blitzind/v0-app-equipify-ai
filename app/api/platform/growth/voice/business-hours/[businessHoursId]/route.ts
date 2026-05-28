import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { updateVoiceBusinessHours } from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER, VOICE_ROUTING_MODES } from "@/lib/voice/types"

export const runtime = "nodejs"

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  weeklyScheduleJson: z.record(z.string(), z.unknown()).optional(),
  holidayRulesJson: z.array(z.unknown()).optional(),
  afterHoursRoutingMode: z.enum(VOICE_ROUTING_MODES).optional(),
  afterHoursForwardingNumber: z.string().trim().max(40).optional(),
  afterHoursVoicemailBoxId: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ businessHoursId: string }> },
) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { businessHoursId } = await context.params
  if (!UUID_RE.test(businessHoursId)) return voiceInvalidIdResponse("Business hours").response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid business hours update." }, { status: 400 })
  }

  const businessHours = await updateVoiceBusinessHours(ctx.admin, ctx.organizationId, businessHoursId, parsed.data)
  if (!businessHours) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Business hours profile not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, businessHours })
}
