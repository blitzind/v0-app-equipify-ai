/** Voice Drop sequence step types — VD-2 (client-safe). */

import type { GrowthSequenceStepChannel } from "@/lib/growth/sequence-types"

export const GROWTH_SEQUENCE_VOICE_DROP_VD_2_QA_MARKER = "growth-sequence-voice-drop-vd-2" as const

export type GrowthSequenceVoiceDropStepDraft = {
  stepOrder: number
  channel: "voice_drop"
  delayDaysMin: number
  delayDaysMax: number
  voiceDropCampaignId: string
  notes?: string | null
}

export type GrowthSequenceVoiceDropStepValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

export function isVoiceDropSequenceStepChannel(
  channel: GrowthSequenceStepChannel,
): channel is "voice_drop" {
  return channel === "voice_drop"
}

export function validateGrowthSequenceVoiceDropStepDraft(
  draft: GrowthSequenceVoiceDropStepDraft,
): GrowthSequenceVoiceDropStepValidationResult {
  if (draft.channel !== "voice_drop") {
    return { ok: false, code: "invalid_channel", message: "Voice drop steps must use voice_drop channel." }
  }
  if (draft.stepOrder < 1) {
    return { ok: false, code: "invalid_step_order", message: "Step order must be at least 1." }
  }
  if (draft.delayDaysMin < 0 || draft.delayDaysMax < draft.delayDaysMin) {
    return { ok: false, code: "invalid_delay", message: "Delay configuration is invalid." }
  }
  if (!draft.voiceDropCampaignId.trim()) {
    return {
      ok: false,
      code: "voice_drop_campaign_required",
      message: "Select an approved voice drop campaign — campaigns are managed in Voice Drop module.",
    }
  }
  return { ok: true }
}
