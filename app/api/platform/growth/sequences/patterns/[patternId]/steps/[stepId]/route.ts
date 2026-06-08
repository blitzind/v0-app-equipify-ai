import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  setGrowthSequencePatternActive,
  updateGrowthSequencePatternStepVoiceDropCampaign,
} from "@/lib/growth/sequence-pattern-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { validateGrowthSequencePatternVoiceDropActivation } from "@/lib/growth/sequences/sequence-voice-drop-pattern-readiness"
import { getVoiceDropCampaign } from "@/lib/voice/repository/voice-drop-repository"
import { requireVoicePlatformRouteContext } from "@/lib/voice/api/voice-platform-route"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ patternId: string; stepId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const voiceCtx = await requireVoicePlatformRouteContext()
  if (!voiceCtx.ok) return voiceCtx.response

  const { patternId, stepId } = await context.params

  try {
    const body = (await request.json().catch(() => ({}))) as {
      voiceDropCampaignId?: string | null
      activatePattern?: boolean
    }

    if (body.voiceDropCampaignId) {
      const campaign = await getVoiceDropCampaign(
        voiceCtx.admin,
        voiceCtx.organizationId,
        body.voiceDropCampaignId,
      )
      if (!campaign || campaign.approvalStatus !== "approved") {
        return NextResponse.json(
          { error: "campaign_not_approved", message: "Only approved Voice Drop campaigns can be linked." },
          { status: 400 },
        )
      }
    }

    const step = await updateGrowthSequencePatternStepVoiceDropCampaign(access.admin, {
      patternId,
      stepId,
      voiceDropCampaignId: body.voiceDropCampaignId ?? null,
    })

    if (body.activatePattern) {
      const patterns = await listGrowthSequencePatterns(access.admin)
      const pattern = patterns.find((entry) => entry.id === patternId)
      if (!pattern) {
        return NextResponse.json({ error: "pattern_not_found" }, { status: 404 })
      }
      const readiness = validateGrowthSequencePatternVoiceDropActivation({
        ...pattern,
        steps: pattern.steps.map((entry) =>
          entry.id === step.id ? { ...entry, voiceDropCampaignId: step.voiceDropCampaignId } : entry,
        ),
      })
      if (!readiness.ok) {
        return NextResponse.json(
          { error: readiness.code, message: readiness.message },
          { status: 400 },
        )
      }
      await setGrowthSequencePatternActive(access.admin, { patternId, isActive: true })
    }

    return NextResponse.json({ ok: true, step })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
