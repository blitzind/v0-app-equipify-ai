import { NextResponse } from "next/server"
import { z } from "zod"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createVoiceVoicemailBox,
  fetchVoiceVoicemailBoxes,
} from "@/lib/voice/repository/voice-operations-repository"
import { VOICE_OPERATIONS_QA_MARKER } from "@/lib/voice/types"

export const runtime = "nodejs"

const PostSchema = z.object({
  name: z.string().trim().min(1).max(120),
  greetingText: z.string().trim().max(4000).optional(),
  notificationEmail: z.string().trim().email().or(z.literal("")).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  retentionDays: z.number().int().min(0).max(3650).optional(),
})

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const voicemailBoxes = await fetchVoiceVoicemailBoxes(ctx.admin, ctx.organizationId)
  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, voicemailBoxes })
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Invalid voicemail box payload." }, { status: 400 })
  }

  const voicemailBox = await createVoiceVoicemailBox(ctx.admin, ctx.organizationId, parsed.data)
  if (!voicemailBox) {
    return NextResponse.json({ ok: false, error: "create_failed", message: "Could not create voicemail box." }, { status: 500 })
  }

  return NextResponse.json({ ok: true, qaMarker: VOICE_OPERATIONS_QA_MARKER, voicemailBox })
}
