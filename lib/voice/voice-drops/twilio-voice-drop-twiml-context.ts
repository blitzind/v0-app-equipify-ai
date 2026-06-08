/** Twilio voice drop TwiML context resolution — VD-1B (client-safe). */

import {
  buildVoiceDropOutboundTwiml,
  type VoiceDropTwimlAnsweredBy,
} from "@/lib/voice/voice-drops/twilio-voice-drop-twiml"

export type VoiceDropTwimlDeliveryContextInput = {
  recipient: {
    campaignId: string
    renderedMessagePreview: string | null
  } | null
  campaign: {
    messageTemplate: string
    voiceId: string | null
  } | null
  answeredBy: VoiceDropTwimlAnsweredBy | string | null
  mediaUrl?: string | null
}

export type VoiceDropTwimlDeliveryContextResult =
  | { ok: true; body: string; message: string; voiceId: string | null }
  | { ok: false; error: "recipient_not_found" | "campaign_not_found" | "empty_message_template" }

export function resolveVoiceDropTwimlDeliveryContext(
  input: VoiceDropTwimlDeliveryContextInput,
): VoiceDropTwimlDeliveryContextResult {
  if (!input.recipient) {
    return { ok: false, error: "recipient_not_found" }
  }

  if (!input.campaign) {
    return { ok: false, error: "campaign_not_found" }
  }

  const message = input.recipient.renderedMessagePreview ?? input.campaign.messageTemplate ?? ""
  if (!message.trim() && normalizeAnsweredByForEmptyMessage(input.answeredBy)) {
    return { ok: false, error: "empty_message_template" }
  }

  const body = buildVoiceDropOutboundTwiml({
    answeredBy: input.answeredBy,
    message,
    voiceId: input.campaign.voiceId,
    mediaUrl: input.mediaUrl ?? null,
  })

  return {
    ok: true,
    body,
    message,
    voiceId: input.campaign.voiceId,
  }
}

function normalizeAnsweredByForEmptyMessage(answeredBy: VoiceDropTwimlAnsweredBy | string | null): boolean {
  const value = String(answeredBy ?? "pending").toLowerCase()
  return value === "machine_end_beep" || value === "machine_end"
}
