/** Twilio voice drop safety gates — VD-1B (client-safe). */

import {
  isTwilioVoiceDropConfigured,
  isTwilioVoiceDropCredentialsConfigured,
  isVoiceDropTwilioOutboundCertified,
} from "@/lib/voice/voice-drops/twilio-voice-drop-config"

export const VOICE_DROP_TWILIO_VD_1B_QA_MARKER = "voice-drop-twilio-vd-1b" as const

export type VoiceDropTwilioQueueGateBlockReason =
  | "voice_drop_disabled"
  | "twilio_not_configured"
  | "twilio_outbound_not_certified"
  | "from_number_missing"

export type VoiceDropTwilioQueueGateResult =
  | { allowed: true }
  | { allowed: false; reason: VoiceDropTwilioQueueGateBlockReason; message: string }

export function isVoiceDropEnabledFromEnv(): boolean {
  return process.env.VOICE_DROP_ENABLED === "true"
}

export function evaluateVoiceDropTwilioQueueGate(input?: {
  voiceDropEnabled?: boolean
  twilioCredentialsConfigured?: boolean
  twilioOutboundCertified?: boolean
  fromNumberConfigured?: boolean
}): VoiceDropTwilioQueueGateResult {
  const voiceDropEnabled = input?.voiceDropEnabled ?? isVoiceDropEnabledFromEnv()
  const twilioCredentialsConfigured =
    input?.twilioCredentialsConfigured ?? isTwilioVoiceDropCredentialsConfigured()
  const twilioOutboundCertified = input?.twilioOutboundCertified ?? isVoiceDropTwilioOutboundCertified()
  const fromNumberConfigured =
    input?.fromNumberConfigured ??
    Boolean(
      process.env.TWILIO_VOICE_FROM_NUMBER?.trim() || process.env.TWILIO_PHONE_NUMBER?.trim(),
    )

  if (!voiceDropEnabled) {
    return {
      allowed: false,
      reason: "voice_drop_disabled",
      message: "Set VOICE_DROP_ENABLED=true to queue voice drop deliveries.",
    }
  }

  if (!twilioCredentialsConfigured) {
    return {
      allowed: false,
      reason: "twilio_not_configured",
      message: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required.",
    }
  }

  if (!fromNumberConfigured) {
    return {
      allowed: false,
      reason: "from_number_missing",
      message: "Set TWILIO_VOICE_FROM_NUMBER for voice drop outbound.",
    }
  }

  if (!twilioOutboundCertified) {
    return {
      allowed: false,
      reason: "twilio_outbound_not_certified",
      message:
        "Twilio voice drop outbound requires VOICE_DROP_TWILIO_OUTBOUND_CERTIFIED=true after compliance certification.",
    }
  }

  return { allowed: true }
}
