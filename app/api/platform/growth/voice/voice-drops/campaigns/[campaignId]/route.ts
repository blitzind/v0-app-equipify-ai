import { NextResponse } from "next/server"
import { requireVoicePlatformRouteContext, UUID_RE, voiceInvalidIdResponse } from "@/lib/voice/api/voice-platform-route"
import { getVoiceDropCampaign } from "@/lib/voice/repository/voice-drop-repository"
import { listVoiceDropRecipients } from "@/lib/voice/repository/voice-drop-repository"
import { fetchVoiceDropCampaignDeliveryEvidence } from "@/lib/voice/voice-drops/voice-drop-delivery-evidence-service"
import {
  previewVoiceDropRecipientsCompliance,
  queueApprovedVoiceDropRecipients,
  transitionVoiceDropCampaign,
} from "@/lib/voice/voice-drops/voice-drop-service"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { campaignId } = await context.params
  if (!UUID_RE.test(campaignId)) return voiceInvalidIdResponse("campaignId")

  try {
    const campaign = await getVoiceDropCampaign(ctx.admin, ctx.organizationId, campaignId)
    const recipients = await listVoiceDropRecipients(ctx.admin, ctx.organizationId, campaignId)
    const deliveryEvidence = await fetchVoiceDropCampaignDeliveryEvidence(ctx.admin, {
      organizationId: ctx.organizationId,
      campaignId,
    })
    return NextResponse.json({ ok: true, campaign, recipients, deliveryEvidence })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

export async function POST(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = await requireVoicePlatformRouteContext()
  if (!ctx.ok) return ctx.response

  const { campaignId } = await context.params
  if (!UUID_RE.test(campaignId)) return voiceInvalidIdResponse("campaignId")

  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      scheduledAt?: string | null
      recipients?: Array<{ phoneNumber: string; recipientName?: string | null }>
    }

    if (body.action === "submit_for_approval") {
      const campaign = await transitionVoiceDropCampaign(ctx.admin, {
        organizationId: ctx.organizationId,
        campaignId,
        transition: "submit_for_approval",
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, campaign })
    }

    if (body.action === "approve") {
      const campaign = await transitionVoiceDropCampaign(ctx.admin, {
        organizationId: ctx.organizationId,
        campaignId,
        transition: "approve",
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, campaign })
    }

    if (body.action === "reject") {
      const campaign = await transitionVoiceDropCampaign(ctx.admin, {
        organizationId: ctx.organizationId,
        campaignId,
        transition: "reject",
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, campaign })
    }

    if (body.action === "preview_recipients" && body.recipients?.length) {
      const result = await previewVoiceDropRecipientsCompliance(ctx.admin, {
        organizationId: ctx.organizationId,
        campaignId,
        recipients: body.recipients,
      })
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.action === "queue") {
      const result = await queueApprovedVoiceDropRecipients(ctx.admin, {
        organizationId: ctx.organizationId,
        campaignId,
        userId: ctx.userId,
      })
      return NextResponse.json({ ok: true, result })
    }

    return NextResponse.json({ error: "invalid_action", message: "Unknown action." }, { status: 400 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "action_failed", message }, { status: 500 })
  }
}
