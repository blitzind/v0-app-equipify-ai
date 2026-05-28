import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { fetchVoiceCallControlReadiness } from "@/lib/voice/call-control/readiness"
import {
  VOICE_CALL_CONTROL_QA_MARKER,
  VOICE_RECORDING_POLICIES,
} from "@/lib/voice/call-control/types"
import {
  fetchVoiceCallControlSettings,
  upsertVoiceCallControlSettings,
} from "@/lib/voice/repository/voice-call-control-repository"

export const runtime = "nodejs"

const PatchSchema = z.object({
  defaultRecordingPolicy: z.enum(VOICE_RECORDING_POLICIES).optional(),
  recordingDisclosureText: z.string().trim().max(2000).optional(),
})

export async function GET(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const origin = new URL(request.url).origin
  const [settings, readiness] = await Promise.all([
    fetchVoiceCallControlSettings(ctx.admin, ctx.organizationId),
    fetchVoiceCallControlReadiness(ctx.admin, ctx.organizationId, origin),
  ])

  return NextResponse.json({
    ok: true,
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    settings,
    readiness,
  })
}

export async function PATCH(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid call control settings." }, { status: 400 })
  }

  const settings = await upsertVoiceCallControlSettings(ctx.admin, ctx.organizationId, parsed.data)
  if (!settings) {
    return NextResponse.json({ ok: false, error: "update_failed", message: "Could not update call control settings." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_CALL_CONTROL_QA_MARKER, settings })
}
