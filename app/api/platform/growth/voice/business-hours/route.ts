import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createVoiceBusinessHours,
  fetchVoiceBusinessHoursList,
} from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER, VOICE_ROUTING_MODES } from "@/lib/voice/types"

export const runtime = "nodejs"

const PostSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(80).optional(),
  weeklyScheduleJson: z.record(z.string(), z.unknown()).optional(),
  holidayRulesJson: z.array(z.unknown()).optional(),
  afterHoursRoutingMode: z.enum(VOICE_ROUTING_MODES).optional(),
  afterHoursForwardingNumber: z.string().trim().max(40).optional(),
  afterHoursVoicemailBoxId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const businessHours = await fetchVoiceBusinessHoursList(ctx.admin, ctx.organizationId)
  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, businessHours })
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid business hours payload." }, { status: 400 })
  }

  const businessHours = await createVoiceBusinessHours(ctx.admin, ctx.organizationId, parsed.data)
  if (!businessHours) {
    return NextResponse.json({ ok: false, error: "create_failed", message: "Could not create business hours." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, businessHours })
}
