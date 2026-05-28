import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import { propagateOptOut } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { VOICE_CONSENT_CHANNELS } from "@/lib/voice/compliance-orchestration/types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      phoneNumber?: string
      reason?: string
      source?: string
      channel?: string
    }

    if (!body.phoneNumber?.trim()) {
      return NextResponse.json({ error: "invalid_phone", message: "phoneNumber required." }, { status: 400 })
    }

    const channel = VOICE_CONSENT_CHANNELS.includes(body.channel as (typeof VOICE_CONSENT_CHANNELS)[number])
      ? (body.channel as (typeof VOICE_CONSENT_CHANNELS)[number])
      : null

    await propagateOptOut(ctx.admin, {
      organizationId: ctx.organizationId,
      phoneNumber: body.phoneNumber,
      reason: body.reason ?? "Operator recorded opt-out.",
      source: body.source ?? "operator",
      channel,
      createdBy: ctx.userId,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "propagation_failed", message }, { status: 500 })
  }
}
