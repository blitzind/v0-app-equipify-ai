/** Voice Drop sequence pattern operator readiness — VD-3 (client-safe). */

import type { GrowthSequencePattern, GrowthSequencePatternStep } from "@/lib/growth/sequence-types"

export const GROWTH_SEQUENCE_VOICE_DROP_VD_3_QA_MARKER = "growth-sequence-voice-drop-vd-3" as const

export const VOICE_DROP_SEQUENCE_COMPLIANCE_WARNING =
  "Voice Drop execution still requires approval, compliance pass, and certified provider gates."

export function listVoiceDropStepsMissingCampaign(steps: GrowthSequencePatternStep[]): GrowthSequencePatternStep[] {
  return steps.filter((step) => step.channel === "voice_drop" && !step.voiceDropCampaignId)
}

export function isGrowthSequencePatternVoiceDropOperatorReady(pattern: GrowthSequencePattern): boolean {
  return listVoiceDropStepsMissingCampaign(pattern.steps).length === 0
}

export function validateGrowthSequencePatternVoiceDropActivation(pattern: GrowthSequencePattern): {
  ok: boolean
  code?: string
  message?: string
} {
  const missing = listVoiceDropStepsMissingCampaign(pattern.steps)
  if (missing.length > 0) {
    return {
      ok: false,
      code: "voice_drop_campaign_required",
      message: `Link an approved Voice Drop campaign for step ${missing.map((s) => s.stepOrder).join(", ")} before activation.`,
    }
  }
  return { ok: true }
}
