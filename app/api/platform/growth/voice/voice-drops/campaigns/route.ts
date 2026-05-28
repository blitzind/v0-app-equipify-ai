import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"
import {
  createDraftVoiceDropCampaign,
  fetchVoiceDropCampaignDashboard,
} from "@/lib/voice/voice-drops/voice-drop-service"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const dashboard = await fetchVoiceDropCampaignDashboard(ctx.admin, ctx.organizationId)
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      messageTemplate?: string
      campaignType?: string
    }
    if (!body.name?.trim() || !body.messageTemplate?.trim()) {
      return NextResponse.json({ error: "invalid_input", message: "name and messageTemplate required." }, { status: 400 })
    }

    const campaign = await createDraftVoiceDropCampaign(ctx.admin, {
      organizationId: ctx.organizationId,
      name: body.name.trim(),
      messageTemplate: body.messageTemplate.trim(),
      createdBy: ctx.userId,
    })
    return NextResponse.json({ ok: true, campaign })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
