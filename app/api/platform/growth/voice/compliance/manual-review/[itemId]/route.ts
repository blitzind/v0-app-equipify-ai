import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import {
  resolveManualReviewItem,
  type ManualReviewAction,
} from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { VOICE_CONSENT_CHANNELS } from "@/lib/voice/compliance-orchestration/types"

export const runtime = "nodejs"

const ACTIONS: ManualReviewAction[] = [
  "approve",
  "reject",
  "add_suppression",
  "grant_consent",
  "deny_consent",
]

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { itemId } = await context.params
  if (!UUID_RE.test(itemId)) return voiceInvalidIdResponse("itemId")

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: ManualReviewAction
      phoneNumber?: string
      channel?: string
      evidenceText?: string
    }

    if (!body.action || !ACTIONS.includes(body.action)) {
      return NextResponse.json({ error: "invalid_action", message: "Unknown action." }, { status: 400 })
    }
    if (!body.phoneNumber?.trim()) {
      return NextResponse.json({ error: "invalid_phone", message: "phoneNumber required." }, { status: 400 })
    }

    const channel = VOICE_CONSENT_CHANNELS.includes(body.channel as (typeof VOICE_CONSENT_CHANNELS)[number])
      ? (body.channel as (typeof VOICE_CONSENT_CHANNELS)[number])
      : "voicemail"

    const result = await resolveManualReviewItem(ctx.admin, {
      organizationId: ctx.organizationId,
      itemId,
      action: body.action,
      phoneNumber: body.phoneNumber,
      channel,
      userId: ctx.userId,
      evidenceText: body.evidenceText,
    })

    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
