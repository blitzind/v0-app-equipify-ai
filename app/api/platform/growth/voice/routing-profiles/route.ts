import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createVoiceRoutingProfile,
  fetchVoiceRoutingProfiles,
} from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER, VOICE_ROUTING_MODES } from "@/lib/voice/types"

export const runtime = "nodejs"

const PostSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  routingMode: z.enum(VOICE_ROUTING_MODES).optional(),
  fallbackMode: z.enum(VOICE_ROUTING_MODES).optional(),
  fallbackPhoneNumber: z.string().trim().max(40).optional(),
  voicemailBoxId: z.string().uuid().nullable().optional(),
  businessHoursId: z.string().uuid().nullable().optional(),
})

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const profiles = await fetchVoiceRoutingProfiles(ctx.admin, ctx.organizationId)
  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, profiles })
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid routing profile payload." }, { status: 400 })
  }

  const profile = await createVoiceRoutingProfile(ctx.admin, ctx.organizationId, parsed.data)
  if (!profile) {
    return NextResponse.json({ ok: false, error: "create_failed", message: "Could not create routing profile." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, profile })
}
